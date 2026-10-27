import Decimal from "decimal.js";
import type { Centavos } from "./dinheiro";

/**
 * Reajuste anual pelo IPCA.
 * - Janela: os 12 meses que terminam 2 meses antes do mês do aniversário
 *   (aniversário em jan/2027 → dez/2025 a nov/2026).
 * - Fator acumulado = Π(1 + variação mensal / 100), sem arredondamento intermediário.
 * - Novo valor arredondado em centavos, meio para cima.
 * - IPCA acumulado negativo: o valor é mantido (reajuste de 0%).
 */

/** Competência no formato "AAAA-MM". */
export type Mes = string;

export function somarMesesCompetencia(mes: Mes, meses: number): Mes {
  const [ano, m] = mes.split("-").map(Number);
  const total = ano * 12 + (m - 1) + meses;
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, "0")}`;
}

/** Os 12 meses de IPCA usados no reajuste cujo aniversário cai no mês informado. */
export function janelaIpca(mesAniversario: Mes): Mes[] {
  return Array.from({ length: 12 }, (_, i) => somarMesesCompetencia(mesAniversario, i - 13));
}

/** Fator acumulado a partir das variações mensais em % (texto, como vêm da API: "0.16"). */
export function fatorAcumulado(variacoesPercentuais: (string | number)[]): Decimal {
  return variacoesPercentuais.reduce<Decimal>(
    (fator, v) => fator.times(new Decimal(1).plus(new Decimal(v).div(100))),
    new Decimal(1),
  );
}

/** Fator a partir do IPCA acumulado informado manualmente (ex.: "4,68" → 1,0468). */
export function fatorDoPercentual(percentual: string | number): Decimal {
  return new Decimal(1).plus(new Decimal(String(percentual).replace(",", ".")).div(100));
}

/** Índice acumulado em %, com 6 casas (para o histórico). */
export function percentualDoFator(fator: Decimal): string {
  return fator.minus(1).times(100).toDecimalPlaces(6, Decimal.ROUND_HALF_UP).toFixed(6);
}

/** Aplica o fator ao valor; com IPCA negativo ou zero mantém o valor. */
export function valorReajustado(valor: Centavos, fator: Decimal): Centavos {
  if (fator.lte(1)) return valor;
  return new Decimal(valor).times(fator).toDecimalPlaces(0, Decimal.ROUND_HALF_UP).toNumber();
}
