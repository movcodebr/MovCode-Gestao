import { describe, expect, it } from "vitest";
import {
  calcularIndicadores,
  mesesDoGrafico,
  type Pago,
  preverRecorrencia,
  resumirInadimplencia,
  serieMensal,
} from "@/lib/dominio/dashboard";
import { contatoPessoal, diaDeLembrete } from "@/lib/dominio/lembretes";

const pagos: Pago[] = [
  { tipo: "entrada", valor: 120000, dataPagamento: "2026-01-15" },
  { tipo: "saida", valor: 20000, dataPagamento: "2026-02-03" },
  { tipo: "entrada", valor: 30000, dataPagamento: "2026-03-10" },
  { tipo: "saida", valor: 12000, dataPagamento: "2026-03-31" },
  { tipo: "entrada", valor: 50000, dataPagamento: "2026-04-01" },
];

describe("saldo e lucro (regime de caixa)", () => {
  it("lucro = entradas pagas − saídas pagas no período; saldo = acumulado até o fim do período", () => {
    expect(calcularIndicadores(pagos, "2026-03-01", "2026-03-31")).toEqual({
      entradas: 30000,
      saidas: 12000,
      lucro: 18000,
      saldo: 118000, // 1200 − 200 + 300 − 120
    });
  });

  it("período sem movimento: lucro zero e saldo acumulado", () => {
    expect(calcularIndicadores(pagos, "2026-02-04", "2026-02-28")).toEqual({ entradas: 0, saidas: 0, lucro: 0, saldo: 100000 });
  });

  it("lucro pode ser negativo", () => {
    expect(calcularIndicadores(pagos, "2026-02-01", "2026-02-28").lucro).toBe(-20000);
  });
});

describe("gráfico de entradas e saídas", () => {
  it("agrupa por mês do pagamento", () => {
    expect(serieMensal(pagos, ["2026-03", "2026-04"])).toEqual([
      { mes: "2026-03", entradas: 30000, saidas: 12000 },
      { mes: "2026-04", entradas: 50000, saidas: 0 },
    ]);
  });

  it("mostra 6 meses até o mês escolhido, os 3 do trimestre ou os 12 do ano", () => {
    expect(mesesDoGrafico("mes", "2026-03-01", "2026-03-31")).toEqual(["2025-10", "2025-11", "2025-12", "2026-01", "2026-02", "2026-03"]);
    expect(mesesDoGrafico("trimestre", "2026-04-01", "2026-06-30")).toEqual(["2026-04", "2026-05", "2026-06"]);
    expect(mesesDoGrafico("ano", "2026-01-01", "2026-12-31")).toHaveLength(12);
  });
});

describe("previsão dos próximos 30 dias", () => {
  it("prevê as cobranças que ainda serão geradas no período, sem repetir as já geradas", () => {
    const r = { dataInicio: "2026-01-31", dia: 31, piso: "2026-01-31", valor: 20000 };
    expect(preverRecorrencia(r, new Set(["2026-01"]), "2026-02-01", "2026-03-31")).toEqual([
      { vencimento: "2026-02-28", valor: 20000 },
      { vencimento: "2026-03-31", valor: 20000 },
    ]);
    expect(preverRecorrencia(r, new Set(["2026-01", "2026-02"]), "2026-02-01", "2026-03-03")).toEqual([]);
  });

  it("respeita a data final do gasto recorrente", () => {
    const g = { dataInicio: "2026-01-10", dia: 10, piso: "2026-01-10", dataFim: "2026-02-28", valor: 5000 };
    expect(preverRecorrencia(g, new Set(), "2026-02-01", "2026-04-30")).toEqual([{ vencimento: "2026-02-10", valor: 5000 }]);
  });
});

describe("inadimplência", () => {
  it("soma o valor e agrupa por cliente, do maior para o menor", () => {
    const r = resumirInadimplencia([
      { clienteId: "a", cliente: "Ana", valor: 20000, diasAtraso: 5 },
      { clienteId: "b", cliente: "Bruno", valor: 70000, diasAtraso: 40 },
      { clienteId: "a", cliente: "Ana", valor: 20000, diasAtraso: 35 },
    ]);
    expect(r.total).toBe(110000);
    expect(r.clientes).toEqual([
      { clienteId: "b", cliente: "Bruno", valor: 70000, cobrancas: 1, maiorAtraso: 40 },
      { clienteId: "a", cliente: "Ana", valor: 40000, cobrancas: 2, maiorAtraso: 35 },
    ]);
  });
});

describe("calendário de lembretes e contato pessoal", () => {
  it("lembra no vencimento e a cada 3 dias; último no 30º dia", () => {
    const dias = Array.from({ length: 40 }, (_, d) => d).filter(diaDeLembrete);
    expect(dias).toEqual([0, 3, 6, 9, 12, 15, 18, 21, 24, 27, 30]);
    expect(diaDeLembrete(-1)).toBe(false); // nunca antes do vencimento
  });

  it("depois de 30 dias de atraso, a cobrança entra em Contato pessoal", () => {
    expect(contatoPessoal(30)).toBe(false);
    expect(contatoPessoal(31)).toBe(true);
  });
});
