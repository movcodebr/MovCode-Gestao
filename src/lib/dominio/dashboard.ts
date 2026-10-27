import type { Centavos } from "./dinheiro";
import type { DataISO } from "./datas";
import { mesDe, primeiroMes, vencimentoNoMes } from "./mensalidades";
import { type Mes, somarMesesCompetencia } from "./reajuste";

/** Lançamento pago, para os cálculos de caixa. */
export type Pago = { tipo: "entrada" | "saida"; valor: Centavos; dataPagamento: DataISO };

export type Indicadores = { entradas: Centavos; saidas: Centavos; lucro: Centavos; saldo: Centavos };

/**
 * Regime de caixa (pela data do pagamento):
 * - Lucro do período = entradas pagas − saídas pagas dentro do período.
 * - Saldo = acumulado de tudo que foi pago desde o início até o fim do período.
 */
export function calcularIndicadores(pagos: Pago[], inicio: DataISO, fim: DataISO): Indicadores {
  let entradas = 0;
  let saidas = 0;
  let saldo = 0;
  for (const p of pagos) {
    if (p.dataPagamento > fim) continue;
    const sinal = p.tipo === "entrada" ? 1 : -1;
    saldo += sinal * p.valor;
    if (p.dataPagamento >= inicio) {
      if (p.tipo === "entrada") entradas += p.valor;
      else saidas += p.valor;
    }
  }
  return { entradas, saidas, lucro: entradas - saidas, saldo };
}

/** Entradas e saídas pagas por mês (para o gráfico). */
export function serieMensal(pagos: Pago[], meses: Mes[]): { mes: Mes; entradas: Centavos; saidas: Centavos }[] {
  const serie = new Map(meses.map((m) => [m, { mes: m, entradas: 0, saidas: 0 }]));
  for (const p of pagos) {
    const ponto = serie.get(mesDe(p.dataPagamento));
    if (!ponto) continue;
    if (p.tipo === "entrada") ponto.entradas += p.valor;
    else ponto.saidas += p.valor;
  }
  return [...serie.values()];
}

/** Meses mostrados no gráfico: o trimestre, o ano, ou os 6 meses até o mês escolhido. */
export function mesesDoGrafico(tipo: "mes" | "trimestre" | "ano", inicio: DataISO, fim: DataISO): Mes[] {
  const primeiro = tipo === "mes" ? somarMesesCompetencia(mesDe(inicio), -5) : mesDe(inicio);
  const meses: Mes[] = [];
  for (let m = primeiro; m <= mesDe(fim); m = somarMesesCompetencia(m, 1)) meses.push(m);
  return meses;
}

export type Previsao = { vencimento: DataISO; valor: Centavos };

/**
 * Cobranças (ou gastos) que ainda serão gerados entre `de` e `ate`, pelas mesmas regras
 * da rotina diária. Usado no "a receber / a pagar dos próximos 30 dias".
 */
export function preverRecorrencia(
  r: { dataInicio: DataISO; dia: number; piso: DataISO; dataFim?: DataISO | null; valor: Centavos },
  existentes: Set<Mes>,
  de: DataISO,
  ate: DataISO,
): Previsao[] {
  const previstas: Previsao[] = [];
  for (let mes = primeiroMes(r.dataInicio, r.dia); ; mes = somarMesesCompetencia(mes, 1)) {
    const vencimento = vencimentoNoMes(mes, r.dia);
    if (vencimento > ate || (r.dataFim && vencimento > r.dataFim)) break;
    if (vencimento < de || vencimento < r.piso || existentes.has(mes)) continue;
    previstas.push({ vencimento, valor: r.valor });
  }
  return previstas;
}

export type CobrancaAtrasada = {
  clienteId: string;
  cliente: string;
  valor: Centavos;
  diasAtraso: number;
};

/** Inadimplência: valor total e clientes com cobrança de mensalidade em atraso. */
export function resumirInadimplencia(atrasadas: CobrancaAtrasada[]): {
  total: Centavos;
  clientes: { clienteId: string; cliente: string; valor: Centavos; cobrancas: number; maiorAtraso: number }[];
} {
  const porCliente = new Map<string, { clienteId: string; cliente: string; valor: number; cobrancas: number; maiorAtraso: number }>();
  for (const a of atrasadas) {
    const c = porCliente.get(a.clienteId) ?? { clienteId: a.clienteId, cliente: a.cliente, valor: 0, cobrancas: 0, maiorAtraso: 0 };
    c.valor += a.valor;
    c.cobrancas += 1;
    c.maiorAtraso = Math.max(c.maiorAtraso, a.diasAtraso);
    porCliente.set(a.clienteId, c);
  }
  return {
    total: atrasadas.reduce((s, a) => s + a.valor, 0),
    clientes: [...porCliente.values()].sort((a, b) => b.valor - a.valor),
  };
}
