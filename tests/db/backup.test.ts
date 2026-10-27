import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { type Banco, comoUsuario, CNPJ_VALIDO, CPF_VALIDO, criarBanco, criarUsuario } from "./banco";

let db: Banco;
let usuario: string;

/** Retrato comparável de todas as tabelas (ordenado por id). */
async function retrato(): Promise<Record<string, unknown[]>> {
  const r: Record<string, unknown[]> = {};
  const { rows } = await db.query<{ t: string }>("select unnest(tabelas_backup()) as t");
  for (const { t } of rows) {
    r[t] = (await db.query(`select to_jsonb(x) as j from ${t} x order by 1`)).rows.map((l) => (l as { j: unknown }).j);
  }
  return r;
}

beforeAll(async () => {
  db = await criarBanco();
  usuario = await criarUsuario(db, "f@movcode.com.br", "Fundador");
  await comoUsuario(db, usuario, async () => {
    const cliente = (
      await db.query<{ id: string }>(
        "insert into clientes (nome, telefone, email, documento) values ('Padaria', '11987654321', 'p@x.com', $1) returning id",
        [CNPJ_VALIDO],
      )
    ).rows[0].id;
    await db.query("insert into clientes (nome, telefone, email, documento) values ('Maria', '11987654322', 'm@x.com', $1)", [CPF_VALIDO]);
    const produto = (await db.query<{ id: string }>("select id from produtos where nome = 'Site institucional'")).rows[0].id;
    const r = await db.query<{ r: { mensalidade_id: string } }>("select registrar_venda($1) as r", [
      JSON.stringify({
        cliente_id: cliente,
        produto_id: produto,
        data_venda: "2026-01-10",
        unica: { valor: 120000, valor_tabela: 120000, forma_pagamento: "pix", parcelas: [{ valor: 120000, vencimento: "2026-01-10" }] },
        mensalidade: { valor: 20000, valor_tabela: 20000, dia_vencimento: 10, data_inicio: "2026-01-10", forma_pagamento: "pix" },
      }),
    ]);
    await db.query(
      `insert into lancamentos (tipo, descricao, valor_centavos, forma_pagamento, vencimento, status, data_pagamento, cliente_id, mensalidade_id, competencia)
       values ('entrada', 'Mensalidade', 20000, 'pix', '2026-02-10', 'pago', '2026-02-11', $1, $2, '2026-02-01')`,
      [cliente, r.rows[0].r.mensalidade_id],
    );
    await db.query(
      "insert into lancamentos (tipo, descricao, categoria, valor_centavos, forma_pagamento, vencimento) values ('saida', 'VPS', 'servidor', 12000, 'cartao', '2026-02-20')",
    );
    await db.query("insert into pausas_lembrete (cliente_id, inicio, fim, motivo) values ($1, '2026-02-01', '2026-02-15', 'acordo')", [cliente]);
    await db.query("update lancamentos set excluido_em = now() where descricao = 'VPS'");
  });
});
afterAll(() => db.close());

describe("backup e restauração", () => {
  it("o backup contém todas as tabelas", async () => {
    const { rows } = await db.query<{ b: { sistema: string; versao: number; tabelas: Record<string, unknown[]> } }>(
      "select exportar_backup() as b",
    );
    const b = rows[0].b;
    expect(b.sistema).toBe("movcode-gestao");
    expect(Object.keys(b.tabelas).sort()).toEqual(
      ["auditoria", "clientes", "documentos", "gastos_recorrentes", "ipca_mensal", "lancamentos", "lembretes_enviados", "mensalidades", "pausas_lembrete", "produtos", "reajustes", "usuarios", "vendas"].sort(),
    );
    expect(b.tabelas.clientes).toHaveLength(2);
    expect(b.tabelas.lancamentos).toHaveLength(3);
  });

  it("restaurar recria os dados exatamente como estavam (inclusive autoria, excluídos e auditoria)", async () => {
    const antes = await retrato();
    const backup = (await db.query<{ b: unknown }>("select exportar_backup() as b")).rows[0].b;

    // Mudanças depois do backup
    await comoUsuario(db, usuario, async () => {
      await db.query("update clientes set nome = 'Mudou' where documento = $1", [CPF_VALIDO]);
      await db.query("update lancamentos set status = 'pago', data_pagamento = '2026-03-01' where descricao = 'Site institucional'");
      await db.query("delete from pausas_lembrete");
      await db.query("insert into produtos (nome, preco_centavos, mensalidade_centavos) values ('Novo', 1, 1)");
    });
    expect(await retrato()).not.toEqual(antes);

    const r = await db.query<{ c: Record<string, number> }>("select restaurar_backup($1) as c", [JSON.stringify(backup)]);
    expect(r.rows[0].c).toMatchObject({ clientes: 2, lancamentos: 3, produtos: 6, pausas_lembrete: 1 });
    expect(await retrato()).toEqual(antes);
  });

  it("depois de restaurar, as regras e a auditoria voltam a funcionar", async () => {
    await comoUsuario(db, usuario, () => db.query("update clientes set nome = 'Depois' where documento = $1", [CPF_VALIDO]));
    const { rows } = await db.query("select acao, usuario_id from auditoria order by id desc limit 1");
    expect(rows[0]).toEqual({ acao: "editou", usuario_id: usuario });
    await expect(db.query("update mensalidades set valor_atual_centavos = 1")).rejects.toThrow(/reajuste/);
  });

  it("arquivo inválido ou incompleto não altera nada", async () => {
    const antes = await retrato();
    await expect(db.query("select restaurar_backup($1)", [JSON.stringify({ sistema: "outro", versao: 1 })])).rejects.toThrow(/não é um backup válido/);
    const incompleto = { sistema: "movcode-gestao", versao: 1, tabelas: { clientes: [] } };
    await expect(db.query("select restaurar_backup($1)", [JSON.stringify(incompleto)])).rejects.toThrow(/falta a tabela/);
    // Falha no meio da carga (dado inválido) desfaz tudo
    const backup = (await db.query<{ b: { tabelas: Record<string, Record<string, unknown>[]> } }>("select exportar_backup() as b")).rows[0].b;
    backup.tabelas.lancamentos[0].valor_centavos = -5;
    await expect(db.query("select restaurar_backup($1)", [JSON.stringify(backup)])).rejects.toThrow();
    expect(await retrato()).toEqual(antes);
  });

  it("usuário logado não consegue exportar nem restaurar diretamente", async () => {
    await expect(comoUsuario(db, usuario, () => db.query("select exportar_backup()"))).rejects.toThrow(/permission denied/);
    await expect(comoUsuario(db, usuario, () => db.query("select restaurar_backup('{}'::jsonb)"))).rejects.toThrow(/permission denied/);
  });
});
