import { describe, expect, it } from "vitest";
import {
  type Acao,
  calcularMrr,
  type DadosMensalidade,
  numeroDaCobranca,
  planejarGastoRecorrente,
  planejarMensalidade,
  primeiroMes,
  proximoReajuste,
  vencimentoNoMes,
} from "@/lib/dominio/mensalidades";
import {
  fatorAcumulado,
  fatorDoPercentual,
  janelaIpca,
  percentualDoFator,
  valorReajustado,
} from "@/lib/dominio/reajuste";

const base: DadosMensalidade = {
  dataInicio: "2026-01-10",
  dia: 10,
  dataCadastro: "2026-01-10",
  reativadoEm: null,
  valorAtual: 20000,
  ativa: true,
};

const cobrancas = (acoes: Acao[]) =>
  acoes.filter((a) => a.tipo === "cobranca").map((a) => (a.tipo === "cobranca" ? [a.vencimento, a.numero, a.valor] : []));

/** IPCA mensal fixo para todos os meses de um intervalo. */
function ipcaFixo(de: string, ate: string, valor: string): Map<string, string> {
  const mapa = new Map<string, string>();
  for (let mes = de; mes <= ate; ) {
    mapa.set(mes, valor);
    const [a, m] = mes.split("-").map(Number);
    mes = m === 12 ? `${a + 1}-01` : `${a}-${String(m + 1).padStart(2, "0")}`;
  }
  return mapa;
}

describe("calendário das cobranças", () => {
  it("gera uma cobrança por mês no dia de vencimento, até hoje", () => {
    expect(cobrancas(planejarMensalidade(base, new Set(), new Set(), new Map(), "2026-04-10"))).toEqual([
      ["2026-01-10", 1, 20000],
      ["2026-02-10", 2, 20000],
      ["2026-03-10", 3, 20000],
      ["2026-04-10", 4, 20000],
    ]);
    // véspera do vencimento: a de abril ainda não existe
    expect(cobrancas(planejarMensalidade(base, new Set(), new Set(), new Map(), "2026-04-09"))).toHaveLength(3);
  });

  it("dia 31 cai no último dia em meses curtos (inclusive fevereiro bissexto)", () => {
    expect(vencimentoNoMes("2026-02", 31)).toBe("2026-02-28");
    expect(vencimentoNoMes("2028-02", 31)).toBe("2028-02-29");
    expect(vencimentoNoMes("2026-04", 31)).toBe("2026-04-30");
    expect(vencimentoNoMes("2026-02", 29)).toBe("2026-02-28");
    const m = { ...base, dataInicio: "2026-01-31", dataCadastro: "2026-01-31", dia: 31 };
    expect(cobrancas(planejarMensalidade(m, new Set(), new Set(), new Map(), "2026-04-30")).map((c) => c[0])).toEqual([
      "2026-01-31",
      "2026-02-28",
      "2026-03-31",
      "2026-04-30",
    ]);
  });

  it("1ª cobrança é o primeiro vencimento a partir da data de início", () => {
    expect(primeiroMes("2026-03-20", 10)).toBe("2026-04");
    expect(primeiroMes("2026-03-10", 10)).toBe("2026-03");
    expect(primeiroMes("2026-02-28", 31)).toBe("2026-02");
    expect(numeroDaCobranca("2026-03-20", 10, "2027-04")).toBe(13);
  });

  it("não duplica: cobranças que já existem não são geradas de novo", () => {
    const existentes = new Set(["2026-01", "2026-02", "2026-03"]);
    expect(cobrancas(planejarMensalidade(base, existentes, new Set(), new Map(), "2026-04-10"))).toEqual([
      ["2026-04-10", 4, 20000],
    ]);
    existentes.add("2026-04");
    expect(planejarMensalidade(base, existentes, new Set(), new Map(), "2026-04-10")).toEqual([]);
  });

  it("recupera dias em que a rotina não rodou", () => {
    const existentes = new Set(["2026-01"]);
    expect(cobrancas(planejarMensalidade(base, existentes, new Set(), new Map(), "2026-03-15")).map((c) => c[0])).toEqual([
      "2026-02-10",
      "2026-03-10",
    ]);
  });

  it("nunca gera cobrança com vencimento anterior ao cadastro da venda", () => {
    const antigo = { ...base, dataInicio: "2025-05-10", dataCadastro: "2026-10-27" };
    expect(cobrancas(planejarMensalidade(antigo, new Set(), new Set(), new Map(), "2026-10-27"))).toEqual([]);
    expect(cobrancas(planejarMensalidade(antigo, new Set(), new Set(), new Map(), "2026-11-10"))).toEqual([
      ["2026-11-10", 19, 20000],
    ]);
  });

  it("mensalidade cancelada ou cliente inativo não geram cobranças", () => {
    expect(planejarMensalidade({ ...base, ativa: false }, new Set(), new Set(), new Map(), "2026-04-10")).toEqual([]);
  });

  it("reativação: volta no próximo vencimento, sem cobrar o período inativo", () => {
    const m = { ...base, reativadoEm: "2026-06-15" };
    const existentes = new Set(["2026-01", "2026-02", "2026-03"]);
    expect(cobrancas(planejarMensalidade(m, existentes, new Set(), new Map(), "2026-07-10"))).toEqual([
      ["2026-07-10", 7, 20000],
    ]);
  });
});

describe("reajuste anual pelo IPCA", () => {
  it("janela: 12 meses terminando 2 meses antes do aniversário", () => {
    const janela = janelaIpca("2027-01");
    expect(janela[0]).toBe("2025-12");
    expect(janela[11]).toBe("2026-11");
    expect(janela).toHaveLength(12);
  });

  it("acumula multiplicando os meses e arredonda o valor em centavos (meio para cima)", () => {
    const fator = fatorAcumulado(Array(12).fill("0.5"));
    expect(percentualDoFator(fator)).toBe("6.167781");
    expect(valorReajustado(20000, fator)).toBe(21234); // 21.233,556 → 21.234
    expect(valorReajustado(10000, fatorDoPercentual("0,005"))).toBe(10001); // 10.000,5 → 10.001
    expect(valorReajustado(10000, fatorDoPercentual("0,0049"))).toBe(10000); // 10.000,49 → 10.000
    expect(valorReajustado(19999, fatorDoPercentual("4,68"))).toBe(20935); // 20.934,95 → 20.935
  });

  it("IPCA acumulado negativo mantém o valor", () => {
    const fator = fatorAcumulado(Array(12).fill("-0.1"));
    expect(valorReajustado(20000, fator)).toBe(20000);
  });

  it("vale a partir da 13ª cobrança; a 12ª ainda sai com o valor original", () => {
    const ipca = ipcaFixo("2025-12", "2026-11", "0.5");
    const acoes = planejarMensalidade(base, new Set(), new Set(), ipca, "2027-01-10");
    const c = cobrancas(acoes);
    expect(c.at(-2)).toEqual(["2026-12-10", 12, 20000]);
    expect(c.at(-1)).toEqual(["2027-01-10", 13, 21234]);
    const reajuste = acoes.find((a) => a.tipo === "reajuste");
    expect(reajuste).toMatchObject({
      aniversario: 1,
      valeAPartirDe: "2027-01",
      janela: { inicio: "2025-12", fim: "2026-11" },
      indicePercentual: "6.167781",
      indiceAplicado: "6.167781",
      valorAnterior: 20000,
      valorNovo: 21234,
    });
    // ordem: o reajuste vem antes da 13ª cobrança
    expect(acoes.findIndex((a) => a.tipo === "reajuste")).toBe(acoes.length - 2);
  });

  it("IPCA negativo registra o índice real e aplica 0%", () => {
    const ipca = ipcaFixo("2025-12", "2026-11", "-0.1");
    const existentes = new Set(Array.from({ length: 12 }, (_, i) => `2026-${String(i + 1).padStart(2, "0")}`));
    const acoes = planejarMensalidade(base, existentes, new Set(), ipca, "2027-01-10");
    expect(acoes[0]).toMatchObject({ tipo: "reajuste", indiceAplicado: "0.000000", valorNovo: 20000 });
    expect(Number((acoes[0] as { indicePercentual: string }).indicePercentual)).toBeLessThan(0);
  });

  it("sem índice: cobrança sai com valor antigo e o reajuste fica pendente; vale na cobrança seguinte", () => {
    const existentes = new Set(Array.from({ length: 12 }, (_, i) => `2026-${String(i + 1).padStart(2, "0")}`));
    const incompleto = ipcaFixo("2025-12", "2026-10", "0.5"); // falta nov/2026
    const dia1 = planejarMensalidade(base, existentes, new Set(), incompleto, "2027-01-10");
    expect(dia1[0]).toMatchObject({ tipo: "reajuste_pendente", aniversario: 1, mesesFaltando: ["2026-11"] });
    expect(cobrancas(dia1)).toEqual([["2027-01-10", 13, 20000]]);

    existentes.add("2027-01");
    const completo = ipcaFixo("2025-12", "2026-11", "0.5");
    const depois = planejarMensalidade(base, existentes, new Set(), completo, "2027-02-10");
    expect(depois[0]).toMatchObject({ tipo: "reajuste", valeAPartirDe: "2027-02", valorNovo: 21234 });
    expect(cobrancas(depois)).toEqual([["2027-02-10", 14, 21234]]);
  });

  it("reajuste já aplicado não é aplicado de novo", () => {
    const ipca = ipcaFixo("2025-12", "2026-11", "0.5");
    const m = { ...base, valorAtual: 21234 };
    const existentes = new Set(Array.from({ length: 12 }, (_, i) => `2026-${String(i + 1).padStart(2, "0")}`));
    const acoes = planejarMensalidade(m, existentes, new Set([1]), ipca, "2027-01-10");
    expect(acoes).toEqual([{ tipo: "cobranca", competencia: "2027-01", vencimento: "2027-01-10", numero: 13, valor: 21234 }]);
  });

  it("aniversários anteriores ao cadastro são ignorados (o valor cadastrado já é o atual)", () => {
    const antigo = { ...base, dataInicio: "2025-05-10", dataCadastro: "2026-10-27" };
    const ipca = ipcaFixo("2024-01", "2027-12", "0.5");
    const acoes = planejarMensalidade(antigo, new Set(), new Set(), ipca, "2026-11-10");
    expect(acoes.some((a) => a.tipo === "reajuste" || a.tipo === "reajuste_pendente")).toBe(false);
    expect(proximoReajuste(antigo, new Set())).toEqual({ aniversario: 2, vencimento: "2027-05-10" });
  });

  it("próximo reajuste de uma mensalidade nova é na 13ª cobrança", () => {
    expect(proximoReajuste(base, new Set())).toEqual({ aniversario: 1, vencimento: "2027-01-10" });
    expect(proximoReajuste(base, new Set([1]))).toEqual({ aniversario: 2, vencimento: "2028-01-10" });
  });
});

describe("MRR", () => {
  it("soma só mensalidades ativas de clientes ativos, pelo valor atual", () => {
    expect(
      calcularMrr([
        { valorAtual: 21234, status: "ativa", clienteAtivo: true },
        { valorAtual: 70000, status: "ativa", clienteAtivo: true },
        { valorAtual: 15000, status: "cancelada", clienteAtivo: true },
        { valorAtual: 50000, status: "ativa", clienteAtivo: false },
      ]),
    ).toBe(91234);
    expect(calcularMrr([])).toBe(0);
  });
});

describe("gastos recorrentes", () => {
  const gasto = { dataInicio: "2026-01-31", dia: 31, dataCadastro: "2026-01-20", dataFim: null, encerradoEm: null, valor: 12000 };

  it("gera um por mês, inclusive em meses curtos, sem duplicar", () => {
    const r = planejarGastoRecorrente(gasto, new Set(["2026-01"]), "2026-03-31");
    expect(r).toEqual([
      { competencia: "2026-02", vencimento: "2026-02-28", valor: 12000 },
      { competencia: "2026-03", vencimento: "2026-03-31", valor: 12000 },
    ]);
  });

  it("respeita a data final e o encerramento", () => {
    expect(planejarGastoRecorrente({ ...gasto, dataFim: "2026-02-28" }, new Set(), "2026-06-30")).toHaveLength(2);
    expect(planejarGastoRecorrente({ ...gasto, encerradoEm: "2026-03-31" }, new Set(), "2026-06-30")).toHaveLength(2);
  });

  it("não gera meses anteriores ao cadastro", () => {
    const antigo = { ...gasto, dataInicio: "2025-01-31", dataCadastro: "2026-03-01" };
    expect(planejarGastoRecorrente(antigo, new Set(), "2026-03-31").map((g) => g.competencia)).toEqual(["2026-03"]);
  });
});

import { proximoMesACobrar, reajustePendente } from "@/lib/dominio/mensalidades";

describe("reajuste pendente e índice manual", () => {
  it("fica pendente quando a data do aniversário chegou e o reajuste não foi aplicado", () => {
    expect(reajustePendente(base, new Set(), "2027-01-09")).toBeNull();
    expect(reajustePendente(base, new Set(), "2027-01-10")).toEqual({
      aniversario: 1,
      mesAniversario: "2027-01",
      vencimento: "2027-01-10",
    });
    expect(reajustePendente(base, new Set([1]), "2027-01-10")).toBeNull();
  });

  it("o índice manual vale a partir da próxima cobrança ainda não gerada", () => {
    const geradas = new Set(Array.from({ length: 13 }, (_, i) => (i < 12 ? `2026-${String(i + 1).padStart(2, "0")}` : "2027-01")));
    expect(proximoMesACobrar(base, geradas, "2027-01-15")).toBe("2027-02");
    // antes da rotina das 9h, a cobrança de hoje ainda não existe: vale já para ela
    geradas.delete("2027-01");
    expect(proximoMesACobrar(base, geradas, "2027-01-10")).toBe("2027-01");
  });
});
