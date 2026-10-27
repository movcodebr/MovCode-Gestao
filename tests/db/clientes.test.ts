import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { type Banco, comoAnonimo, CPF_VALIDO, criarBanco, definirHoje } from "./banco";

let db: Banco;
let clienteId: string;
let mensalidadeId: string;

beforeAll(async () => {
  db = await criarBanco();
  clienteId = (
    await db.query<{ id: string }>(
      `insert into clientes (nome, telefone, email, documento)
       values ('Cliente', '11987654321', 'c@x.com', $1) returning id`,
      [CPF_VALIDO],
    )
  ).rows[0].id;
  const produto = (await db.query<{ id: string }>("select id from produtos limit 1")).rows[0].id;
  const venda = (
    await db.query<{ id: string }>(
      `insert into vendas (cliente_id, produto_id, tipo, valor_tabela_centavos, valor_centavos, data_venda)
       values ($1, $2, 'mensalidade', 20000, 20000, '2026-01-10') returning id`,
      [clienteId, produto],
    )
  ).rows[0].id;
  mensalidadeId = (
    await db.query<{ id: string }>(
      `insert into mensalidades (venda_id, cliente_id, produto_id, valor_inicial_centavos, valor_atual_centavos,
         dia_vencimento, data_inicio, forma_pagamento)
       values ($1, $2, $3, 20000, 20000, 10, '2026-01-10', 'pix') returning id`,
      [venda, clienteId, produto],
    )
  ).rows[0].id;
});
afterAll(() => db.close());

async function situacao() {
  return (
    await db.query<{ em_atraso: boolean; lembretes_pausados_ate: string | null }>(
      "select em_atraso, to_char(lembretes_pausados_ate, 'YYYY-MM-DD') as lembretes_pausados_ate from v_clientes where id = $1",
      [clienteId],
    )
  ).rows[0];
}

describe("situação do cliente", () => {
  it("fica 'Paga' sem cobranças atrasadas e 'Em atraso' quando alguma vence sem pagamento", async () => {
    await db.query(
      `insert into lancamentos (tipo, descricao, valor_centavos, forma_pagamento, vencimento, cliente_id,
         mensalidade_id, competencia)
       values ('entrada', 'Mensalidade', 20000, 'pix', '2026-02-10', $1, $2, '2026-02-01')`,
      [clienteId, mensalidadeId],
    );
    await definirHoje(db, "2026-02-10");
    expect((await situacao()).em_atraso).toBe(false);
    await definirHoje(db, "2026-02-11");
    expect((await situacao()).em_atraso).toBe(true);
    await db.query("update lancamentos set status = 'pago', data_pagamento = '2026-02-11'");
    expect((await situacao()).em_atraso).toBe(false);
  });

  it("venda única atrasada não deixa o cliente 'Em atraso' de mensalidade", async () => {
    await db.query(
      `insert into lancamentos (tipo, descricao, valor_centavos, forma_pagamento, vencimento, cliente_id)
       values ('entrada', 'Venda avulsa', 50000, 'pix', '2026-02-01', $1)`,
      [clienteId],
    );
    expect((await situacao()).em_atraso).toBe(false);
  });
});

describe("indicador de lembretes pausados", () => {
  it("mostra a data final enquanto a pausa vale e some na data final ou ao retomar", async () => {
    await db.query(
      "insert into pausas_lembrete (cliente_id, inicio, fim, motivo) values ($1, '2026-03-01', '2026-03-20', 'prazo negociado')",
      [clienteId],
    );
    await definirHoje(db, "2026-02-28");
    expect((await situacao()).lembretes_pausados_ate).toBeNull();
    await definirHoje(db, "2026-03-19");
    expect((await situacao()).lembretes_pausados_ate).toBe("2026-03-20");
    await definirHoje(db, "2026-03-20");
    expect((await situacao()).lembretes_pausados_ate).toBeNull();

    await definirHoje(db, "2026-03-05");
    await db.query("update pausas_lembrete set retomado_em = '2026-03-05'");
    expect((await situacao()).lembretes_pausados_ate).toBeNull();
  });
});

describe("inativar e reativar cliente", () => {
  it("guarda a data da reativação", async () => {
    await definirHoje(db, "2026-04-01");
    await db.query("update clientes set ativo = false where id = $1", [clienteId]);
    await definirHoje(db, "2026-06-15");
    await db.query("update clientes set ativo = true where id = $1", [clienteId]);
    const { rows } = await db.query<{ r: string }>(
      "select to_char(reativado_em, 'YYYY-MM-DD') as r from clientes where id = $1",
      [clienteId],
    );
    expect(rows[0].r).toBe("2026-06-15");
  });

  it("visitante não logado não acessa a lista de clientes", async () => {
    await expect(comoAnonimo(db, () => db.query("select * from v_clientes"))).rejects.toThrow(/permission denied/);
  });
});
