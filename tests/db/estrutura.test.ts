import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  type Banco,
  CNPJ_ALFANUMERICO_VALIDO,
  CNPJ_VALIDO,
  comoAnonimo,
  comoUsuario,
  CPF_VALIDO,
  CPF_VALIDO_2,
  criarBanco,
  criarUsuario,
  definirHoje,
} from "./banco";

let db: Banco;
let fundador: string;
let socio: string;

beforeAll(async () => {
  db = await criarBanco();
  fundador = await criarUsuario(db, "fundador@movcode.com.br", "Fundador");
  socio = await criarUsuario(db, "socio@movcode.com.br", "Sócio");
});
afterAll(() => db.close());

async function inserirCliente(documento: string, extra: Record<string, string> = {}) {
  const dados = { nome: "Cliente Teste", telefone: "11987654321", email: "cliente@exemplo.com", documento, ...extra };
  const { rows } = await db.query<{ id: string; tipo: string; criado_por: string }>(
    `insert into clientes (nome, telefone, email, documento) values ($1, $2, $3, $4)
     returning id, tipo, criado_por`,
    [dados.nome, dados.telefone, dados.email, dados.documento],
  );
  return rows[0];
}

describe("migrações e carga inicial", () => {
  it("cria os 6 produtos do catálogo com preço e mensalidade em centavos", async () => {
    const { rows } = await db.query<{ nome: string; preco_centavos: number; mensalidade_centavos: number }>(
      "select nome, preco_centavos::int, mensalidade_centavos::int from produtos order by preco_centavos",
    );
    expect(rows).toEqual([
      { nome: "Automação simples", preco_centavos: 40000, mensalidade_centavos: 20000 },
      { nome: "Landing page", preco_centavos: 60000, mensalidade_centavos: 15000 },
      { nome: "Integração (API, pagamento, ERP)", preco_centavos: 100000, mensalidade_centavos: 30000 },
      { nome: "Site institucional", preco_centavos: 120000, mensalidade_centavos: 20000 },
      { nome: "E-commerce", preco_centavos: 300000, mensalidade_centavos: 50000 },
      { nome: "Software / app sob medida", preco_centavos: 500000, mensalidade_centavos: 70000 },
    ]);
  });

  it("cria o perfil do usuário automaticamente ao criar o login", async () => {
    const { rows } = await db.query("select nome, email from usuarios order by email");
    expect(rows).toEqual([
      { nome: "Fundador", email: "fundador@movcode.com.br" },
      { nome: "Sócio", email: "socio@movcode.com.br" },
    ]);
  });
});

describe("segurança de acesso (RLS)", () => {
  it("visitante não logado não acessa nenhum dado", async () => {
    for (const tabela of ["clientes", "produtos", "lancamentos", "v_lancamentos", "documentos", "auditoria"]) {
      await expect(comoAnonimo(db, () => db.query(`select * from ${tabela}`)), tabela).rejects.toThrow(
        /permission denied/,
      );
    }
  });

  it("usuário logado lê e cadastra, e a autoria é registrada", async () => {
    const cliente = await comoUsuario(db, fundador, () => inserirCliente(CPF_VALIDO));
    expect(cliente.criado_por).toBe(fundador);
    const produtos = await comoUsuario(db, socio, () => db.query("select id from produtos"));
    expect(produtos.rows).toHaveLength(6);
  });

  it("usuário logado não consegue gravar na auditoria nem apagar lançamentos de verdade", async () => {
    await expect(
      comoUsuario(db, fundador, () =>
        db.query("insert into auditoria (tabela, registro_id, acao) values ('x', gen_random_uuid(), 'criou')"),
      ),
    ).rejects.toThrow();
    await expect(comoUsuario(db, fundador, () => db.query("delete from lancamentos"))).rejects.toThrow(
      /permission denied/,
    );
  });
});

describe("clientes: documento, duplicidade e contato", () => {
  it("define o tipo automaticamente: CPF = PF, CNPJ = PJ (inclusive CNPJ alfanumérico)", async () => {
    expect((await inserirCliente(CPF_VALIDO_2)).tipo).toBe("PF");
    expect((await inserirCliente(CNPJ_VALIDO)).tipo).toBe("PJ");
    expect((await inserirCliente(CNPJ_ALFANUMERICO_VALIDO)).tipo).toBe("PJ");
  });

  it("rejeita CPF/CNPJ com dígito verificador errado ou repetido", async () => {
    for (const doc of ["52998224724", "11111111111", "11222333000182", "00000000000000", "123", "12ABC34501DE36"]) {
      await expect(inserirCliente(doc), doc).rejects.toThrow(/check constraint/);
    }
  });

  it("impede cliente duplicado (mesmo CPF/CNPJ)", async () => {
    await expect(inserirCliente(CPF_VALIDO)).rejects.toThrow(/duplicate key/);
  });

  it("rejeita telefone sem DDD válido e e-mail mal formatado", async () => {
    await expect(inserirCliente("39053344705", { telefone: "987654321" })).rejects.toThrow(/check constraint/);
    await expect(inserirCliente("39053344705", { telefone: "01987654321" })).rejects.toThrow(/check constraint/);
    await expect(inserirCliente("39053344705", { email: "sem-arroba.com" })).rejects.toThrow(/check constraint/);
  });
});

describe("lançamentos: integridade, status e auditoria", () => {
  let clienteId: string;
  let mensalidadeId: string;
  let produtoId: string;

  beforeAll(async () => {
    clienteId = (await db.query<{ id: string }>("select id from clientes where documento = $1", [CPF_VALIDO]))
      .rows[0].id;
    produtoId = (await db.query<{ id: string }>("select id from produtos where nome = 'Site institucional'"))
      .rows[0].id;
    const venda = await db.query<{ id: string }>(
      `insert into vendas (cliente_id, produto_id, tipo, valor_tabela_centavos, valor_centavos, data_venda)
       values ($1, $2, 'mensalidade', 20000, 20000, '2026-01-10') returning id`,
      [clienteId, produtoId],
    );
    mensalidadeId = (
      await db.query<{ id: string }>(
        `insert into mensalidades (venda_id, cliente_id, produto_id, valor_inicial_centavos, valor_atual_centavos,
           dia_vencimento, data_inicio, forma_pagamento)
         values ($1, $2, $3, 20000, 20000, 10, '2026-01-10', 'pix') returning id`,
        [venda.rows[0].id, clienteId, produtoId],
      )
    ).rows[0].id;
  });

  async function inserirCobranca(competencia: string, vencimento: string) {
    const { rows } = await db.query<{ id: string }>(
      `insert into lancamentos (tipo, descricao, valor_centavos, forma_pagamento, vencimento,
         cliente_id, mensalidade_id, competencia)
       values ('entrada', 'Mensalidade', 20000, 'pix', $1, $2, $3, $4) returning id`,
      [vencimento, clienteId, mensalidadeId, competencia],
    );
    return rows[0].id;
  }

  it("não permite duas cobranças da mesma mensalidade no mesmo mês", async () => {
    await inserirCobranca("2026-01-01", "2026-01-10");
    await expect(inserirCobranca("2026-01-01", "2026-01-10")).rejects.toThrow(/duplicate key/);
  });

  it("deriva o status: pendente vencido vira Atrasado; pago continua Pago", async () => {
    const id = await inserirCobranca("2026-02-01", "2026-02-10");
    const status = async () =>
      (
        await db.query<{ status_efetivo: string; dias_atraso: number }>(
          "select status_efetivo, dias_atraso from v_lancamentos where id = $1",
          [id],
        )
      ).rows[0];

    await definirHoje(db, "2026-02-10");
    expect(await status()).toEqual({ status_efetivo: "pendente", dias_atraso: 0 });
    await definirHoje(db, "2026-02-14");
    expect(await status()).toEqual({ status_efetivo: "atrasado", dias_atraso: 4 });
    await db.query("update lancamentos set status = 'pago', data_pagamento = '2026-02-14' where id = $1", [id]);
    expect(await status()).toEqual({ status_efetivo: "pago", dias_atraso: 0 });
  });

  it("exige data de pagamento quando pago e categoria nas saídas", async () => {
    const id = await inserirCobranca("2026-03-01", "2026-03-10");
    await expect(db.query("update lancamentos set status = 'pago' where id = $1", [id])).rejects.toThrow(
      /check constraint/,
    );
    await expect(
      db.query(
        `insert into lancamentos (tipo, descricao, valor_centavos, forma_pagamento, vencimento)
         values ('saida', 'Servidor', 5000, 'pix', '2026-03-10')`,
      ),
    ).rejects.toThrow(/check constraint/);
  });

  it("registra quem criou, editou e excluiu, e esconde o excluído", async () => {
    const id = await comoUsuario(db, fundador, async () =>
      (
        await db.query<{ id: string }>(
          `insert into lancamentos (tipo, descricao, valor_centavos, forma_pagamento, vencimento, categoria)
           values ('saida', 'Hospedagem', 5000, 'pix', '2026-03-10', 'servidor') returning id`,
        )
      ).rows[0].id,
    );
    await comoUsuario(db, socio, () => db.query("update lancamentos set valor_centavos = 6000 where id = $1", [id]));
    await comoUsuario(db, fundador, () => db.query("update lancamentos set excluido_em = now() where id = $1", [id]));

    const auditoria = await db.query<{ acao: string; usuario_id: string }>(
      "select acao, usuario_id from auditoria where registro_id = $1 order by id",
      [id],
    );
    expect(auditoria.rows).toEqual([
      { acao: "criou", usuario_id: fundador },
      { acao: "editou", usuario_id: socio },
      { acao: "excluiu", usuario_id: fundador },
    ]);
    const lanc = await db.query<{ excluido_por: string; atualizado_por: string }>(
      "select excluido_por, atualizado_por from lancamentos where id = $1",
      [id],
    );
    expect(lanc.rows[0]).toEqual({ excluido_por: fundador, atualizado_por: fundador });
    const visiveis = await db.query("select 1 from v_lancamentos where id = $1", [id]);
    expect(visiveis.rows).toHaveLength(0);
    await expect(db.query("update lancamentos set valor_centavos = 1 where id = $1", [id])).rejects.toThrow(
      /já excluído/,
    );
  });

  it("não permite excluir produto já usado em venda", async () => {
    await expect(db.query("delete from produtos where id = $1", [produtoId])).rejects.toThrow(/foreign key/);
  });
});
