import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { type Banco, CNPJ_VALIDO, comoAnonimo, comoUsuario, criarBanco, criarUsuario } from "./banco";

let db: Banco;
let fundador: string;

beforeAll(async () => {
  db = await criarBanco();
  fundador = await criarUsuario(db, "fundador@movcode.com.br", "Fundador");
});
afterAll(() => db.close());

async function inserirLead(instagram: string, extra: Record<string, unknown> = {}) {
  const dados = { instagram, nome: "Negócio", ...extra };
  const colunas = Object.keys(dados);
  const { rows } = await db.query<{ id: string; criado_por: string | null }>(
    `insert into leads (${colunas.join(", ")}) values (${colunas.map((_, i) => `$${i + 1}`).join(", ")})
     returning id, criado_por`,
    Object.values(dados),
  );
  return rows[0];
}

describe("prospecção", () => {
  it("começa com a configuração padrão da busca, numa linha só", async () => {
    const { rows } = await db.query<{ cidades: string[]; leads_por_dia: number }>(
      "select cidades, leads_por_dia from prospeccao_config",
    );
    expect(rows).toEqual([{ cidades: ["Ribeirão Preto"], leads_por_dia: 8 }]);
    await expect(db.query("insert into prospeccao_config (id) values (false)")).rejects.toThrow();
    await expect(comoUsuario(db, fundador, () => db.query("delete from prospeccao_config"))).rejects.toThrow(
      /permission denied/,
    );
  });

  it("visitante não logado não vê nem grava leads", async () => {
    await expect(comoAnonimo(db, () => db.query("select * from leads"))).rejects.toThrow(/permission denied/);
    await expect(comoAnonimo(db, () => db.query("select * from prospeccao_config"))).rejects.toThrow(/permission denied/);
    await expect(comoAnonimo(db, () => db.query("select * from v_leads_por_etapa"))).rejects.toThrow(/permission denied/);
  });

  it("usuário logado cadastra e edita, com autoria e auditoria", async () => {
    const lead = await comoUsuario(db, fundador, () => inserirLead("cao_kilate"));
    expect(lead.criado_por).toBe(fundador);
    await comoUsuario(db, fundador, () =>
      db.query("update leads set etapa = 'abordado', responsavel_id = $1 where id = $2", [fundador, lead.id]),
    );
    const { rows } = await db.query<{ acao: string; usuario_id: string }>(
      "select acao, usuario_id from auditoria where tabela = 'leads' and registro_id = $1 order by id",
      [lead.id],
    );
    expect(rows).toEqual([
      { acao: "criou", usuario_id: fundador },
      { acao: "editou", usuario_id: fundador },
    ]);
  });

  it("um lead por @ do Instagram, sempre em minúsculas e sem @", async () => {
    await inserirLead("barbearia777");
    await expect(inserirLead("barbearia777")).rejects.toThrow(/duplicate key/);
    await expect(inserirLead("@Barbearia")).rejects.toThrow(/check/);
    // A rotina grava com "on conflict do nothing": o lead existente não muda
    await db.query("insert into leads (instagram, nome) values ('barbearia777', 'Outro nome') on conflict (instagram) do nothing");
    const { rows } = await db.query("select nome from leads where instagram = 'barbearia777'");
    expect(rows).toEqual([{ nome: "Negócio" }]);
  });

  it("recusa etapa desconhecida, nota fora de 0 a 100 e links que não são http(s)", async () => {
    await expect(inserirLead("a1", { etapa: "ganhou" })).rejects.toThrow(/check/);
    await expect(inserirLead("a2", { nota: 101 })).rejects.toThrow(/check/);
    await expect(inserirLead("a3", { site_url: "javascript:alert(1)" })).rejects.toThrow(/check/);
    await expect(inserirLead("a4", { link_previa: "ftp://x" })).rejects.toThrow(/check/);
    await expect(inserirLead("a5", { followups_enviados: 3 })).rejects.toThrow(/check/);
  });

  it("conta os leads por etapa do funil", async () => {
    const { rows } = await comoUsuario(db, fundador, () =>
      db.query("select etapa, quantidade from v_leads_por_etapa order by etapa"),
    );
    expect(rows).toEqual([
      { etapa: "abordado", quantidade: 1 },
      { etapa: "novo", quantidade: 1 },
    ]);
  });

  it("ao excluir o cliente, o lead continua, só sem o vínculo", async () => {
    const cliente = (
      await db.query<{ id: string }>(
        "insert into clientes (nome, telefone, email, documento) values ('Cão Kilate', '16987654321', 'c@k.com', $1) returning id",
        [CNPJ_VALIDO],
      )
    ).rows[0].id;
    await db.query("update leads set cliente_id = $1, etapa = 'fechado' where instagram = 'cao_kilate'", [cliente]);
    await db.query("delete from clientes where id = $1", [cliente]);
    const { rows } = await db.query("select etapa, cliente_id from leads where instagram = 'cao_kilate'");
    expect(rows).toEqual([{ etapa: "fechado", cliente_id: null }]);
  });
});
