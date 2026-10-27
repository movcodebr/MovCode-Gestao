import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { type Banco, comoUsuario, CPF_VALIDO, criarBanco, criarUsuario, definirHoje } from "./banco";

let db: Banco;
let usuario: string;
let mensalidadeId: string;
let clienteId: string;

beforeAll(async () => {
  db = await criarBanco();
  usuario = await criarUsuario(db, "socio@movcode.com.br", "Sócio");
  clienteId = (
    await db.query<{ id: string }>(
      `insert into clientes (nome, telefone, email, documento) values ('C', '11987654321', 'c@x.com', $1) returning id`,
      [CPF_VALIDO],
    )
  ).rows[0].id;
  const produto = (await db.query<{ id: string }>("select id from produtos limit 1")).rows[0].id;
  const r = await db.query<{ r: { mensalidade_id: string } }>("select registrar_venda($1) as r", [
    JSON.stringify({
      cliente_id: clienteId,
      produto_id: produto,
      data_venda: "2026-01-10",
      mensalidade: { valor: 20000, valor_tabela: 20000, dia_vencimento: 10, data_inicio: "2026-01-10", forma_pagamento: "pix" },
    }),
  ]);
  mensalidadeId = r.rows[0].r.mensalidade_id;
});
afterAll(() => db.close());

const reajuste = (extra: Record<string, unknown> = {}) => ({
  mensalidade_id: mensalidadeId,
  aniversario: 1,
  vale_a_partir_de: "2027-01-01",
  janela_inicio: "2025-12-01",
  janela_fim: "2026-11-01",
  indice_percentual: "6.167781",
  indice_aplicado: "6.167781",
  fonte: "bcb",
  valor_anterior: 20000,
  valor_novo: 21234,
  ...extra,
});

async function valorAtual() {
  return Number(
    (await db.query<{ v: number }>("select valor_atual_centavos as v from mensalidades where id = $1", [mensalidadeId]))
      .rows[0].v,
  );
}

describe("aplicar reajuste", () => {
  it("atualiza o valor e guarda o histórico (data, índice, valor anterior e novo)", async () => {
    await definirHoje(db, "2027-01-10");
    await comoUsuario(db, usuario, () => db.query("select aplicar_reajuste($1)", [JSON.stringify(reajuste())]));
    expect(await valorAtual()).toBe(21234);
    const { rows } = await db.query(
      `select aniversario, to_char(aplicado_em, 'YYYY-MM-DD') as aplicado_em, indice_percentual::text as indice,
              valor_anterior_centavos::int as anterior, valor_novo_centavos::int as novo, fonte, registrado_por
       from reajustes where mensalidade_id = $1`,
      [mensalidadeId],
    );
    expect(rows).toEqual([
      { aniversario: 1, aplicado_em: "2027-01-10", indice: "6.167781", anterior: 20000, novo: 21234, fonte: "bcb", registrado_por: usuario },
    ]);
  });

  it("não aplica o mesmo aniversário duas vezes nem com valor desatualizado", async () => {
    await expect(db.query("select aplicar_reajuste($1)", [JSON.stringify(reajuste({ valor_anterior: 21234, valor_novo: 22000 }))])).rejects.toThrow(
      /duplicate key/,
    );
    await expect(db.query("select aplicar_reajuste($1)", [JSON.stringify(reajuste({ aniversario: 2 }))])).rejects.toThrow(
      /valor mudou/,
    );
    expect(await valorAtual()).toBe(21234);
  });

  it("o valor da mensalidade não pode ser alterado à mão (só pelo reajuste)", async () => {
    await expect(db.query("update mensalidades set valor_atual_centavos = 1 where id = $1", [mensalidadeId])).rejects.toThrow(
      /só muda pelo reajuste/,
    );
  });
});

describe("cancelar mensalidade", () => {
  it("registra a data e quem cancelou; cobranças já geradas continuam", async () => {
    await db.query(
      `insert into lancamentos (tipo, descricao, valor_centavos, forma_pagamento, vencimento, cliente_id, mensalidade_id, competencia)
       values ('entrada', 'Mensalidade', 21234, 'pix', '2027-01-10', $1, $2, '2027-01-01')`,
      [clienteId, mensalidadeId],
    );
    await definirHoje(db, "2027-01-20");
    await comoUsuario(db, usuario, () => db.query("update mensalidades set status = 'cancelada' where id = $1", [mensalidadeId]));
    const { rows } = await db.query(
      "select to_char(cancelada_em, 'YYYY-MM-DD') as em, cancelada_por from mensalidades where id = $1",
      [mensalidadeId],
    );
    expect(rows[0]).toEqual({ em: "2027-01-20", cancelada_por: usuario });
    expect((await db.query("select count(*)::int as n from v_lancamentos where mensalidade_id = $1", [mensalidadeId])).rows[0]).toEqual({ n: 1 });
  });

  it("mensalidade cancelada não volta a ficar ativa nem recebe reajuste", async () => {
    await expect(db.query("update mensalidades set status = 'ativa', cancelada_em = null where id = $1", [mensalidadeId])).rejects.toThrow(
      /não pode ser reativada/,
    );
    await expect(
      db.query("select aplicar_reajuste($1)", [JSON.stringify(reajuste({ aniversario: 2, valor_anterior: 21234, valor_novo: 22000 }))]),
    ).rejects.toThrow(/não está ativa/);
  });
});
