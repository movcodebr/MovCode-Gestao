/**
 * Teste de integração da rotina diária contra um Supabase de verdade (local).
 * Não roda no CI: execute com `npm run test:integracao` com o Supabase local no ar
 * e o .env.local apontando para ele. Usa `docker exec db psql` para ajustar datas.
 */
import { execSync } from "node:child_process";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { beforeAll, describe, expect, it } from "vitest";
import { canalSomenteLog } from "@/lib/lembretes/canais";
import { executarTarefaDiaria } from "@/lib/servicos/tarefa-diaria";

const ativo = process.env.INTEGRACAO === "1";
let admin: SupabaseClient;

function sql(comando: string): string {
  return execSync(`docker exec -i db psql -qtA -U postgres -h localhost -d postgres`, { input: comando }).toString().trim();
}

/** IPCA falso de 0,5% ao mês para qualquer período pedido. */
const ipcaFalso = (async () => {
  const pontos = [];
  for (let ano = 2024; ano <= 2027; ano++) for (let m = 1; m <= 12; m++) pontos.push({ data: `01/${String(m).padStart(2, "0")}/${ano}`, valor: "0.5" });
  return new Response(JSON.stringify(pontos));
}) as unknown as typeof fetch;

const rodar = (hoje: string) =>
  executarTarefaDiaria(admin, hoje, {
    buscar: ipcaFalso,
    canais: () => [canalSomenteLog("email")],
    pagamento: { chavePix: "chave-teste", favorecido: "Teste" },
  });

function cobrancas(mensalidade: string): string[] {
  return sql(
    `select to_char(vencimento,'YYYY-MM-DD')||'='||valor_centavos from lancamentos where mensalidade_id='${mensalidade}' order by vencimento`,
  ).split("\n").filter(Boolean);
}

describe.skipIf(!ativo)("rotina diária (integração)", () => {
  let m31: string;
  let m10: string;
  let gasto: string;
  let cliente: string;

  beforeAll(async () => {
    admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
      auth: { persistSession: false },
    });
    sql(
      "set session_replication_role = replica; delete from reajustes; delete from lembretes_enviados; delete from lancamentos; delete from mensalidades; delete from vendas; delete from gastos_recorrentes; delete from pausas_lembrete; delete from clientes; delete from ipca_mensal;",
    );
    cliente = sql(
      "insert into clientes (nome, telefone, email, documento) values ('Rotina Teste', '11987654321', 'r@x.com', '52998224725') returning id",
    );
    const site = sql("select id from produtos where nome = 'Site institucional'");
    const app = sql("select id from produtos where nome like 'Software%'");
    const venda = (produto: string, dia: number, inicio: string, valor: number) =>
      sql(
        `select registrar_venda('${JSON.stringify({
          cliente_id: cliente,
          produto_id: produto,
          data_venda: inicio,
          mensalidade: { valor, valor_tabela: valor, dia_vencimento: dia, data_inicio: inicio, forma_pagamento: "pix" },
        })}'::jsonb) ->> 'mensalidade_id'`,
      );
    m31 = venda(site, 31, "2026-01-31", 20000);
    m10 = venda(app, 10, "2026-01-10", 70000);
    gasto = sql(
      "insert into gastos_recorrentes (descricao, categoria, valor_centavos, forma_pagamento, dia_vencimento, data_inicio) values ('VPS', 'servidor', 12000, 'cartao', 15, '2026-01-15') returning id",
    );
    // Simula cadastro feito em 01/01/2026 (senão o sistema não gera nada antes de hoje)
    sql(
      `set session_replication_role = replica; update mensalidades set criado_em = '2026-01-01T12:00:00Z'; update gastos_recorrentes set criado_em = '2026-01-01T12:00:00Z';`,
    );
  });

  it("gera uma cobrança por mês por mensalidade (dia 31 em meses curtos) e os gastos recorrentes", async () => {
    const etapas = await rodar("2026-04-30");
    expect(etapas.every((e) => e.ok), JSON.stringify(etapas)).toBe(true);
    expect(cobrancas(m31)).toEqual(["2026-01-31=20000", "2026-02-28=20000", "2026-03-31=20000", "2026-04-30=20000"]);
    expect(cobrancas(m10)).toEqual(["2026-01-10=70000", "2026-02-10=70000", "2026-03-10=70000", "2026-04-10=70000"]);
    expect(sql(`select count(*) from lancamentos where gasto_recorrente_id='${gasto}'`)).toBe("4");
    expect(sql("select count(*) from ipca_mensal")).toBe("48");
  });

  it("rodar duas vezes no mesmo dia não duplica nada", async () => {
    const antes = sql("select count(*) from lancamentos");
    await rodar("2026-04-30");
    expect(sql("select count(*) from lancamentos")).toBe(antes);
  });

  it("cancelar uma mensalidade para só as cobranças dela", async () => {
    sql(`update mensalidades set status = 'cancelada' where id = '${m10}'`);
    await rodar("2026-05-31");
    expect(cobrancas(m10)).toHaveLength(4);
    expect(cobrancas(m31).at(-1)).toBe("2026-05-31=20000");
  });

  it("cliente inativo não gera cobranças; ao reativar, não cobra o período inativo", async () => {
    sql(`update clientes set ativo = false where id = '${cliente}'`);
    await rodar("2026-06-30");
    expect(cobrancas(m31).at(-1)).toBe("2026-05-31=20000");
    sql(`update clientes set ativo = true where id = '${cliente}'; update clientes set reativado_em = '2026-07-15' where id = '${cliente}';`);
    await rodar("2026-07-31");
    expect(cobrancas(m31).slice(-2)).toEqual(["2026-05-31=20000", "2026-07-31=20000"]);
  });

  it("aplica o reajuste IPCA na 13ª cobrança e guarda o histórico", async () => {
    await rodar("2027-01-31");
    const lista = cobrancas(m31);
    expect(lista.slice(-2)).toEqual(["2026-12-31=20000", "2027-01-31=21234"]);
    expect(sql(`select valor_atual_centavos from mensalidades where id = '${m31}'`)).toBe("21234");
    expect(
      sql(`select aniversario||'|'||indice_percentual||'|'||valor_anterior_centavos||'|'||valor_novo_centavos||'|'||fonte from reajustes where mensalidade_id='${m31}'`),
    ).toBe("1|6.167781|20000|21234|bcb");
    // mensalidade cancelada não é reajustada
    expect(sql(`select count(*) from reajustes where mensalidade_id='${m10}'`)).toBe("0");
  });
});
