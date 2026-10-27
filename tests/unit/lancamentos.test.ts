import { describe, expect, it } from "vitest";
import { deslocarPeriodo, intervaloDoPeriodo, nomeDoPeriodo, dataValida } from "@/lib/dominio/datas";
import {
  esquemaEdicaoLancamento,
  esquemaGasto,
  esquemaVenda,
  statusEfetivo,
  validarParcelas,
  valorDiferenteDaTabela,
} from "@/lib/dominio/lancamentos";

const CLIENTE = "3f2b6a1e-1c2d-4e5f-8a9b-0c1d2e3f4a5b";
const PRODUTO = "7a8b9c0d-1e2f-4a3b-8c4d-5e6f7a8b9c0d";

describe("status do lançamento", () => {
  it("pendente com vencimento passado vira Atrasado; no dia do vencimento continua Pendente", () => {
    expect(statusEfetivo("pendente", "2026-03-10", "2026-03-10")).toBe("pendente");
    expect(statusEfetivo("pendente", "2026-03-10", "2026-03-11")).toBe("atrasado");
    expect(statusEfetivo("pago", "2026-03-10", "2026-04-30")).toBe("pago");
  });
});

describe("parcelas da venda única", () => {
  it("aceita parcelas livres que somam o total", () => {
    expect(
      validarParcelas(150000, [
        { valor: 50000, vencimento: "2026-03-05" },
        { valor: 100000, vencimento: "2026-05-20" },
      ]),
    ).toBeNull();
  });

  it("recusa soma diferente (nem 1 centavo a mais ou a menos)", () => {
    expect(validarParcelas(150000, [{ valor: 149999, vencimento: "2026-03-05" }])).toMatch(/soma/);
    expect(validarParcelas(150000, [{ valor: 150001, vencimento: "2026-03-05" }])).toMatch(/soma/);
  });

  it("recusa lista vazia, parcela zerada e vencimento inválido", () => {
    expect(validarParcelas(100, [])).toMatch(/ao menos uma/);
    expect(validarParcelas(100, [{ valor: 100, vencimento: "2026-03-05" }, { valor: 0, vencimento: "2026-03-05" }])).toMatch(/maior que zero/);
    expect(validarParcelas(100, [{ valor: 100, vencimento: "2026-02-30" }])).toMatch(/vencimento/);
  });

  it("identifica valor diferente da tabela", () => {
    expect(valorDiferenteDaTabela(120000, 120000)).toBe(false);
    expect(valorDiferenteDaTabela(150000, 120000)).toBe(true);
  });
});

describe("formulário de venda", () => {
  const base = { cliente_id: CLIENTE, produto_id: PRODUTO, data_venda: "2026-03-05", incluir_mensalidade: false };
  const unica = { valor: "1.200,00", forma_pagamento: "pix", parcelas: [{ valor: "1.200,00", vencimento: "2026-03-05" }] };
  const mensalidade = { valor: "200,00", dia_vencimento: "31", data_inicio: "2026-03-05", forma_pagamento: "boleto" };

  it("venda única: converte valores para centavos e ignora a mensalidade", () => {
    const r = esquemaVenda.parse({ ...base, tipo: "unica", unica, mensalidade });
    expect(r.unica).toEqual({ valor: 120000, forma_pagamento: "pix", parcelas: [{ valor: 120000, vencimento: "2026-03-05" }] });
    expect(r.mensalidade).toBeUndefined();
  });

  it("mensalidade: exige dia de vencimento entre 1 e 31", () => {
    expect(esquemaVenda.parse({ ...base, tipo: "mensalidade", mensalidade }).mensalidade?.dia_vencimento).toBe(31);
    const r = esquemaVenda.safeParse({ ...base, tipo: "mensalidade", mensalidade: { ...mensalidade, dia_vencimento: "32" } });
    expect(r.success).toBe(false);
    expect(r.error!.issues[0].message).toMatch(/1 a 31/);
  });

  it("'incluir mensalidade também' mantém as duas partes", () => {
    const r = esquemaVenda.parse({ ...base, tipo: "unica", incluir_mensalidade: true, unica, mensalidade });
    expect(r.unica?.valor).toBe(120000);
    expect(r.mensalidade?.valor).toBe(20000);
  });

  it("recusa parcelas que não fecham com o total", () => {
    const r = esquemaVenda.safeParse({
      ...base,
      tipo: "unica",
      unica: { ...unica, parcelas: [{ valor: "600,00", vencimento: "2026-03-05" }] },
    });
    expect(r.success).toBe(false);
    expect(r.error!.issues.find((i) => i.path[0] === "parcelas")?.message).toMatch(/soma/);
  });
});

describe("formulário de gasto", () => {
  it("valida categoria e data final do recorrente", () => {
    const ok = esquemaGasto.parse({
      descricao: "Hospedagem",
      categoria: "servidor",
      valor: "89,90",
      forma_pagamento: "cartao",
      vencimento: "2026-03-10",
      recorrente: "sim",
      data_fim: "",
    });
    expect(ok.valor).toBe(8990);
    const semCategoria = esquemaGasto.safeParse({ ...ok, valor: "89,90", categoria: "lanche" });
    expect(semCategoria.error!.issues[0].path[0]).toBe("categoria");
    const fimAntes = esquemaGasto.safeParse({ ...ok, valor: "89,90", data_fim: "2026-01-01" });
    expect(fimAntes.error!.issues[0].path[0]).toBe("data_fim");
  });

  it("edição: pago exige data de pagamento; pendente limpa a data", () => {
    const base = { descricao: "X", valor: "10,00", forma_pagamento: "pix", vencimento: "2026-03-10", status: "pago" };
    expect(esquemaEdicaoLancamento.safeParse(base).success).toBe(false);
    expect(esquemaEdicaoLancamento.parse({ ...base, status: "pendente", data_pagamento: "2026-03-10" }).data_pagamento).toBeNull();
  });
});

describe("períodos do filtro", () => {
  it("calcula mês, trimestre e ano, inclusive fevereiro bissexto", () => {
    expect(intervaloDoPeriodo("mes", "2028-02-15")).toEqual({ inicio: "2028-02-01", fim: "2028-02-29" });
    expect(intervaloDoPeriodo("mes", "2026-02-15")).toEqual({ inicio: "2026-02-01", fim: "2026-02-28" });
    expect(intervaloDoPeriodo("trimestre", "2026-05-20")).toEqual({ inicio: "2026-04-01", fim: "2026-06-30" });
    expect(intervaloDoPeriodo("ano", "2026-05-20")).toEqual({ inicio: "2026-01-01", fim: "2026-12-31" });
  });

  it("navega para o período anterior e o próximo", () => {
    expect(deslocarPeriodo("mes", "2026-01-15", -1)).toBe("2025-12-01");
    expect(deslocarPeriodo("trimestre", "2026-11-01", 1)).toBe("2027-02-01");
    expect(deslocarPeriodo("ano", "2026-03-01", -1)).toBe("2025-03-01");
  });

  it("dá nome ao período e valida datas", () => {
    expect(nomeDoPeriodo("mes", "2026-03-01")).toBe("março de 2026");
    expect(nomeDoPeriodo("trimestre", "2026-08-01")).toBe("3º trimestre de 2026");
    expect(dataValida("2026-02-29")).toBe(false);
    expect(dataValida("2028-02-29")).toBe(true);
  });
});
