import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { type Banco, comoUsuario, CPF_VALIDO, criarBanco, criarUsuario } from "./banco";

let db: Banco;
let usuario: string;
let clienteId: string;
let produtoId: string;

beforeAll(async () => {
  db = await criarBanco();
  usuario = await criarUsuario(db, "fundador@movcode.com.br", "Fundador");
  clienteId = (
    await db.query<{ id: string }>(
      `insert into clientes (nome, telefone, email, documento)
       values ('Cliente', '11987654321', 'c@x.com', $1) returning id`,
      [CPF_VALIDO],
    )
  ).rows[0].id;
  produtoId = (await db.query<{ id: string }>("select id from produtos where nome = 'Site institucional'")).rows[0].id;
});
afterAll(() => db.close());

function venda(extra: Record<string, unknown>) {
  return { cliente_id: clienteId, produto_id: produtoId, data_venda: "2026-03-05", unica: null, mensalidade: null, ...extra };
}

async function registrar(dados: Record<string, unknown>) {
  return comoUsuario(db, usuario, async () => {
    const { rows } = await db.query<{ r: Record<string, string> }>("select registrar_venda($1) as r", [
      JSON.stringify(dados),
    ]);
    return rows[0].r;
  });
}

async function contar(tabela: string) {
  return Number((await db.query<{ n: number }>(`select count(*)::int as n from ${tabela}`)).rows[0].n);
}

describe("registrar venda", () => {
  it("venda única em parcelas livres gera um lançamento por parcela", async () => {
    const r = await registrar(
      venda({
        unica: {
          valor: 150000,
          valor_tabela: 120000,
          forma_pagamento: "pix",
          parcelas: [
            { valor: 75000, vencimento: "2026-03-05" },
            { valor: 75000, vencimento: "2026-04-20" },
          ],
        },
      }),
    );
    const { rows } = await db.query(
      `select descricao, valor_centavos::int as valor, to_char(vencimento, 'YYYY-MM-DD') as vencimento, parcela,
              status, criado_por
       from lancamentos where venda_id = $1 order by parcela`,
      [r.venda_unica_id],
    );
    expect(rows).toEqual([
      { descricao: "Site institucional (parcela 1/2)", valor: 75000, vencimento: "2026-03-05", parcela: 1, status: "pendente", criado_por: usuario },
      { descricao: "Site institucional (parcela 2/2)", valor: 75000, vencimento: "2026-04-20", parcela: 2, status: "pendente", criado_por: usuario },
    ]);
    const v = await db.query("select valor_tabela_centavos::int as tabela, valor_centavos::int as valor from vendas where id = $1", [
      r.venda_unica_id,
    ]);
    expect(v.rows[0]).toEqual({ tabela: 120000, valor: 150000 });
  });

  it("recusa parcelas que não somam o valor da venda, sem gravar nada", async () => {
    const antes = [await contar("vendas"), await contar("lancamentos")];
    await expect(
      registrar(
        venda({
          unica: {
            valor: 120000,
            valor_tabela: 120000,
            forma_pagamento: "pix",
            parcelas: [{ valor: 60000, vencimento: "2026-03-05" }, { valor: 59999, vencimento: "2026-04-05" }],
          },
        }),
      ),
    ).rejects.toThrow(/soma das parcelas/);
    expect([await contar("vendas"), await contar("lancamentos")]).toEqual(antes);
  });

  it("'incluir mensalidade também' cria a venda única e a mensalidade juntas", async () => {
    const r = await registrar(
      venda({
        unica: { valor: 120000, valor_tabela: 120000, forma_pagamento: "boleto", parcelas: [{ valor: 120000, vencimento: "2026-03-10" }] },
        mensalidade: { valor: 20000, valor_tabela: 20000, dia_vencimento: 31, data_inicio: "2026-04-01", forma_pagamento: "pix" },
      }),
    );
    expect(r.venda_unica_id).toBeTruthy();
    const m = await db.query(
      `select valor_inicial_centavos::int as inicial, valor_atual_centavos::int as atual, dia_vencimento,
              to_char(data_inicio, 'YYYY-MM-DD') as inicio, status
       from mensalidades where id = $1`,
      [r.mensalidade_id],
    );
    expect(m.rows[0]).toEqual({ inicial: 20000, atual: 20000, dia_vencimento: 31, inicio: "2026-04-01", status: "ativa" });
    const parcela = await db.query("select descricao from lancamentos where venda_id = $1", [r.venda_unica_id]);
    expect(parcela.rows[0]).toEqual({ descricao: "Site institucional" });
  });

  it("um cliente pode ter várias mensalidades ao mesmo tempo", async () => {
    const app = (await db.query<{ id: string }>("select id from produtos where nome like 'Software%'")).rows[0].id;
    await registrar({
      ...venda({}),
      produto_id: app,
      mensalidade: { valor: 70000, valor_tabela: 70000, dia_vencimento: 5, data_inicio: "2026-03-05", forma_pagamento: "pix" },
    });
    const { rows } = await db.query("select count(*)::int as n from mensalidades where cliente_id = $1 and status = 'ativa'", [
      clienteId,
    ]);
    expect(rows[0]).toEqual({ n: 2 });
  });

  it("recusa venda vazia, cliente inativo e produto desativado", async () => {
    await expect(registrar(venda({}))).rejects.toThrow(/venda única, a mensalidade/);
    const mensal = { valor: 1000, valor_tabela: 1000, dia_vencimento: 1, data_inicio: "2026-03-05", forma_pagamento: "pix" };
    await db.query("update produtos set ativo = false where id = $1", [produtoId]);
    await expect(registrar(venda({ mensalidade: mensal }))).rejects.toThrow(/Produto desativado/);
    await db.query("update produtos set ativo = true where id = $1", [produtoId]);
    await db.query("update clientes set ativo = false where id = $1", [clienteId]);
    await expect(registrar(venda({ mensalidade: mensal }))).rejects.toThrow(/Cliente inativo/);
    await db.query("update clientes set ativo = true where id = $1", [clienteId]);
  });

  it("recusa dia de vencimento fora de 1 a 31", async () => {
    await expect(
      registrar(venda({ mensalidade: { valor: 1000, valor_tabela: 1000, dia_vencimento: 32, data_inicio: "2026-03-05", forma_pagamento: "pix" } })),
    ).rejects.toThrow(/check constraint/);
  });
});

describe("editar ou excluir parcela mantém o total da venda", () => {
  it("o valor da venda acompanha a soma das parcelas ativas", async () => {
    const r = await registrar(
      venda({
        unica: {
          valor: 100000,
          valor_tabela: 100000,
          forma_pagamento: "pix",
          parcelas: [{ valor: 50000, vencimento: "2026-03-05" }, { valor: 50000, vencimento: "2026-04-05" }],
        },
      }),
    );
    const total = async () =>
      (await db.query<{ v: number }>("select valor_centavos::int as v from vendas where id = $1", [r.venda_unica_id])).rows[0].v;
    await comoUsuario(db, usuario, () =>
      db.query("update lancamentos set valor_centavos = 60000 where venda_id = $1 and parcela = 2", [r.venda_unica_id]),
    );
    expect(await total()).toBe(110000);
    await comoUsuario(db, usuario, () =>
      db.query("update lancamentos set excluido_em = now() where venda_id = $1 and parcela = 1", [r.venda_unica_id]),
    );
    expect(await total()).toBe(60000);
  });
});
