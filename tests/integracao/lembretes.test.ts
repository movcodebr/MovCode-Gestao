/**
 * Integração dos lembretes com um Supabase de verdade (local). Rode com `npm run test:integracao`.
 */
import { execSync } from "node:child_process";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { beforeAll, describe, expect, it } from "vitest";
import type { CanalEnvio } from "@/lib/lembretes/canais";
import { executarLembretes } from "@/lib/servicos/lembretes";

const ativo = process.env.INTEGRACAO === "1";
let admin: SupabaseClient;
const pagamento = { chavePix: "chave", favorecido: "Mov Code" };

function sql(comando: string): string {
  return execSync("docker exec -i db psql -qtA -U postgres -h localhost -d postgres", { input: comando }).toString().trim();
}

const enviados: string[] = [];
const email: CanalEnvio = {
  canal: "email",
  modo: "real",
  async enviar(g, m) {
    enviados.push(`email|${g.cliente.nome}|${g.itens.length}|${m.assunto}`);
    return { ok: true };
  },
};
const whatsappQuebrado: CanalEnvio = {
  canal: "whatsapp",
  modo: "real",
  async enviar() {
    return { ok: false, erro: "número inválido" };
  },
};

describe.skipIf(!ativo)("lembretes (integração)", () => {
  let joao: string;

  beforeAll(() => {
    admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
      auth: { persistSession: false },
    });
    sql(
      "set session_replication_role = replica; delete from reajustes; delete from lembretes_enviados; delete from lancamentos; delete from mensalidades; delete from vendas; delete from gastos_recorrentes; delete from pausas_lembrete; delete from clientes;",
    );
    joao = sql("insert into clientes (nome, telefone, email, documento) values ('João', '11987654321', 'joao@x.com', '11222333000181') returning id");
    const ana = sql("insert into clientes (nome, telefone, email, documento) values ('Ana', '11987654322', 'ana@x.com', '52998224725') returning id");
    const inativo = sql("insert into clientes (nome, telefone, email, documento) values ('Inativo', '11987654323', 'i@x.com', '12345678909') returning id");
    const produto = (nome: string) => sql(`select id from produtos where nome like '${nome}%'`);
    const venda = (cliente: string, prod: string, valor: number) =>
      sql(
        `select registrar_venda('${JSON.stringify({ cliente_id: cliente, produto_id: produto(prod), data_venda: "2026-01-01", mensalidade: { valor, valor_tabela: valor, dia_vencimento: 10, data_inicio: "2026-01-01", forma_pagamento: "pix" } })}'::jsonb) ->> 'mensalidade_id'`,
      );
    const cobranca = (cliente: string, mensalidade: string, vencimento: string) =>
      sql(
        `insert into lancamentos (tipo, descricao, valor_centavos, forma_pagamento, vencimento, cliente_id, mensalidade_id, competencia)
         values ('entrada', 'Mensalidade', 20000, 'pix', '${vencimento}', '${cliente}', '${mensalidade}', date_trunc('month', '${vencimento}'::date)) returning id`,
      );
    // João: duas mensalidades, uma vence hoje (10/03) e outra venceu há 3 dias (07/03 → outra competência)
    const site = venda(joao, "Site", 20000);
    const app = venda(joao, "Software", 70000);
    cobranca(joao, site, "2026-03-10");
    cobranca(joao, app, "2026-02-05"); // 33 dias: contato pessoal, sem lembrete
    sql(`update lancamentos set vencimento = '2026-03-07' where mensalidade_id = '${app}'`);
    // Ana: cobrança paga hoje → nenhum lembrete
    const anaSite = venda(ana, "Landing", 15000);
    const paga = cobranca(ana, anaSite, "2026-03-10");
    sql(`update lancamentos set status = 'pago', data_pagamento = '2026-03-10' where id = '${paga}'`);
    // Cliente inativo → nenhum lembrete
    const m = venda(inativo, "E-commerce", 50000);
    cobranca(inativo, m, "2026-03-10");
    sql(`update clientes set ativo = false where id = '${inativo}'`);
  });

  it("envia um único lembrete por canal para o João, com as duas cobranças, e registra cada envio", async () => {
    const r = await executarLembretes(admin, "2026-03-10", [whatsappQuebrado, email], pagamento);
    expect(enviados).toEqual(["email|João|2|Lembrete de pagamento — Mov Code"]);
    expect(r).toMatchObject({ lembretes: 1, falhas: 1, cobrancas: 2 });
    expect(sql("select canal||'|'||sucesso||'|'||coalesce(erro,'') from lembretes_enviados order by canal, dias_atraso").split("\n")).toEqual([
      "email|true|",
      "email|true|",
      "whatsapp|false|número inválido",
      "whatsapp|false|número inválido",
    ]);
  });

  it("rodar de novo no mesmo dia não reenvia nada", async () => {
    await executarLembretes(admin, "2026-03-10", [whatsappQuebrado, email], pagamento);
    expect(enviados).toHaveLength(1);
    expect(sql("select count(*) from lembretes_enviados")).toBe("4");
  });

  it("dia fora do calendário não envia; pausa bloqueia; pagamento interrompe", async () => {
    await executarLembretes(admin, "2026-03-11", [email], pagamento);
    expect(enviados).toHaveLength(1);
    sql(`insert into pausas_lembrete (cliente_id, inicio, fim) values ('${joao}', '2026-03-12', '2026-03-14')`);
    await executarLembretes(admin, "2026-03-13", [email], pagamento); // dia 3 da Site, mas pausado
    expect(enviados).toHaveLength(1);
    sql("update lancamentos set status = 'pago', data_pagamento = '2026-03-15' where vencimento = '2026-03-10' and descricao = 'Mensalidade' and cliente_id = (select id from clientes where nome = 'João')");
    await executarLembretes(admin, "2026-03-16", [email], pagamento); // dia 6 da Site (paga) e dia 9 do App
    expect(enviados.at(-1)).toBe("email|João|1|Mensalidade Mov Code em aberto há 9 dias");
  });
});
