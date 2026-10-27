import type Decimal from "decimal.js";
import type { Centavos } from "./dinheiro";
import { type DataISO, montarData, ultimoDiaDoMes } from "./datas";
import {
  fatorAcumulado,
  janelaIpca,
  type Mes,
  percentualDoFator,
  somarMesesCompetencia,
  valorReajustado,
} from "./reajuste";

/**
 * Calendário das mensalidades e geração das cobranças.
 *
 * Regras:
 * - Cada mensalidade ativa de cliente ativo gera uma cobrança por mês, no seu dia de vencimento
 *   (em meses mais curtos, no último dia do mês).
 * - 1ª cobrança: primeiro vencimento ≥ data de início.
 * - Nunca gera cobrança com vencimento anterior ao cadastro da venda, nem do período em que
 *   o cliente ficou inativo (vencimento ≥ data de reativação).
 * - Cobrança nº 12k+1 sai com o k-ésimo reajuste IPCA aplicado. Aniversários anteriores ao
 *   cadastro são ignorados (o valor cadastrado já é o atual).
 */

/** "2026-03-01" ou "2026-03" → "2026-03" */
export function mesDe(data: string): Mes {
  return data.slice(0, 7);
}

/** "2026-03" → "2026-03-01" (formato da coluna competencia) */
export function competenciaDoMes(mes: Mes): DataISO {
  return `${mes}-01`;
}

/** Vencimento da mensalidade num mês: o dia combinado ou o último dia do mês, se for mais curto. */
export function vencimentoNoMes(mes: Mes, dia: number): DataISO {
  const [ano, m] = mes.split("-").map(Number);
  return montarData(ano, m, Math.min(dia, ultimoDiaDoMes(ano, m)));
}

/** Mês da 1ª cobrança: o primeiro vencimento a partir da data de início. */
export function primeiroMes(dataInicio: DataISO, dia: number): Mes {
  const mes = mesDe(dataInicio);
  return vencimentoNoMes(mes, dia) >= dataInicio ? mes : somarMesesCompetencia(mes, 1);
}

function diferencaMeses(de: Mes, ate: Mes): number {
  const [a1, m1] = de.split("-").map(Number);
  const [a2, m2] = ate.split("-").map(Number);
  return (a2 - a1) * 12 + (m2 - m1);
}

/** Número da cobrança (1ª, 2ª, ...) pelo calendário, contando desde a 1ª. */
export function numeroDaCobranca(dataInicio: DataISO, dia: number, mes: Mes): number {
  return diferencaMeses(primeiroMes(dataInicio, dia), mes) + 1;
}

/** Mês da cobrança em que o k-ésimo reajuste passa a valer (cobrança nº 12k+1). */
export function mesDoAniversario(dataInicio: DataISO, dia: number, k: number): Mes {
  return somarMesesCompetencia(primeiroMes(dataInicio, dia), 12 * k);
}

export type DadosMensalidade = {
  dataInicio: DataISO;
  dia: number;
  /** Data (Brasília) em que a venda foi cadastrada no sistema */
  dataCadastro: DataISO;
  /** Data da última reativação do cliente, se houver */
  reativadoEm: DataISO | null;
  valorAtual: Centavos;
  /** Mensalidade ativa e cliente ativo */
  ativa: boolean;
};

export type Acao =
  | {
      tipo: "reajuste";
      aniversario: number;
      valeAPartirDe: Mes;
      janela: { inicio: Mes; fim: Mes };
      indicePercentual: string;
      indiceAplicado: string;
      valorAnterior: Centavos;
      valorNovo: Centavos;
    }
  | { tipo: "reajuste_pendente"; aniversario: number; mesAniversario: Mes; mesesFaltando: Mes[] }
  | { tipo: "cobranca"; competencia: Mes; vencimento: DataISO; numero: number; valor: Centavos };

/** Primeiro aniversário que conta: os anteriores ao cadastro são ignorados. */
export function primeiroAniversarioValido(m: Pick<DadosMensalidade, "dataInicio" | "dia" | "dataCadastro">): number {
  let k = 1;
  while (vencimentoNoMes(mesDoAniversario(m.dataInicio, m.dia, k), m.dia) < m.dataCadastro) k++;
  return k;
}

/** Calcula o reajuste do aniversário k, se todos os 12 meses de IPCA estiverem disponíveis. */
export function calcularReajuste(
  m: Pick<DadosMensalidade, "dataInicio" | "dia">,
  k: number,
  valorAtual: Centavos,
  ipca: Map<Mes, string>,
  valeAPartirDe: Mes,
): Extract<Acao, { tipo: "reajuste" | "reajuste_pendente" }> {
  const mesAniversario = mesDoAniversario(m.dataInicio, m.dia, k);
  const meses = janelaIpca(mesAniversario);
  const faltando = meses.filter((mes) => !ipca.has(mes));
  if (faltando.length > 0) {
    return { tipo: "reajuste_pendente", aniversario: k, mesAniversario, mesesFaltando: faltando };
  }
  const fator = fatorAcumulado(meses.map((mes) => ipca.get(mes)!));
  return montarReajuste(k, fator, valorAtual, valeAPartirDe, { inicio: meses[0], fim: meses[11] });
}

export function montarReajuste(
  k: number,
  fator: Decimal,
  valorAtual: Centavos,
  valeAPartirDe: Mes,
  janela: { inicio: Mes; fim: Mes },
): Extract<Acao, { tipo: "reajuste" }> {
  const indice = percentualDoFator(fator);
  return {
    tipo: "reajuste",
    aniversario: k,
    valeAPartirDe,
    janela,
    indicePercentual: indice,
    indiceAplicado: fator.lte(1) ? "0.000000" : indice,
    valorAnterior: valorAtual,
    valorNovo: valorReajustado(valorAtual, fator),
  };
}

/**
 * Planeja o que a rotina diária deve fazer com uma mensalidade: quais reajustes aplicar e
 * quais cobranças criar (só as que ainda não existem). Não altera nada; quem executa é o serviço.
 */
export function planejarMensalidade(
  m: DadosMensalidade,
  competenciasExistentes: Set<Mes>,
  aniversariosAplicados: Set<number>,
  ipca: Map<Mes, string>,
  hoje: DataISO,
): Acao[] {
  if (!m.ativa) return [];
  const acoes: Acao[] = [];
  const piso = [m.dataInicio, m.dataCadastro, m.reativadoEm ?? ""].sort().at(-1)!;
  const aplicados = new Set(aniversariosAplicados);
  const kMinimo = primeiroAniversarioValido(m);
  const pendentesAvisados = new Set<number>();
  let valor = m.valorAtual;

  for (let mes = primeiroMes(m.dataInicio, m.dia); ; mes = somarMesesCompetencia(mes, 1)) {
    const vencimento = vencimentoNoMes(mes, m.dia);
    if (vencimento > hoje) break;
    if (vencimento < piso || competenciasExistentes.has(mes)) continue;

    const numero = numeroDaCobranca(m.dataInicio, m.dia, mes);
    const aniversariosDevidos = Math.floor((numero - 1) / 12);
    for (let k = kMinimo; k <= aniversariosDevidos; k++) {
      if (aplicados.has(k)) continue;
      const r = calcularReajuste(m, k, valor, ipca, mes);
      if (r.tipo === "reajuste_pendente") {
        if (!pendentesAvisados.has(k)) acoes.push(r);
        pendentesAvisados.add(k);
        break; // reajustes são aplicados em ordem
      }
      acoes.push(r);
      aplicados.add(k);
      valor = r.valorNovo;
    }
    acoes.push({ tipo: "cobranca", competencia: mes, vencimento, numero, valor });
  }
  return acoes;
}

/**
 * Próximo reajuste da mensalidade (para exibir na tela do cliente): o primeiro aniversário
 * válido ainda não aplicado. Se a data já passou, o reajuste está pendente de índice.
 */
export function proximoReajuste(
  m: Pick<DadosMensalidade, "dataInicio" | "dia" | "dataCadastro">,
  aniversariosAplicados: Set<number>,
): { aniversario: number; vencimento: DataISO } {
  let k = primeiroAniversarioValido(m);
  while (aniversariosAplicados.has(k)) k++;
  return { aniversario: k, vencimento: vencimentoNoMes(mesDoAniversario(m.dataInicio, m.dia, k), m.dia) };
}

// ---------------------------------------------------------------------
// MRR e gastos recorrentes
// ---------------------------------------------------------------------

/** MRR: soma do valor atual das mensalidades ativas de clientes ativos. Vendas únicas nunca entram. */
export function calcularMrr(
  mensalidades: { valorAtual: Centavos; status: "ativa" | "cancelada"; clienteAtivo: boolean }[],
): Centavos {
  return mensalidades
    .filter((m) => m.status === "ativa" && m.clienteAtivo)
    .reduce((total, m) => total + m.valorAtual, 0);
}

export type DadosGastoRecorrente = {
  dataInicio: DataISO;
  dia: number;
  dataCadastro: DataISO;
  dataFim: DataISO | null;
  encerradoEm: DataISO | null;
  valor: Centavos;
};

/** Meses de gasto recorrente que devem ser lançados até hoje e ainda não existem. */
export function planejarGastoRecorrente(
  g: DadosGastoRecorrente,
  existentes: Set<Mes>,
  hoje: DataISO,
): { competencia: Mes; vencimento: DataISO; valor: Centavos }[] {
  const piso = g.dataInicio > g.dataCadastro ? g.dataInicio : g.dataCadastro;
  const lancar: { competencia: Mes; vencimento: DataISO; valor: Centavos }[] = [];
  for (let mes = primeiroMes(g.dataInicio, g.dia); ; mes = somarMesesCompetencia(mes, 1)) {
    const vencimento = vencimentoNoMes(mes, g.dia);
    if (vencimento > hoje || (g.dataFim && vencimento > g.dataFim)) break;
    if (g.encerradoEm && vencimento >= g.encerradoEm) break;
    if (vencimento < piso || existentes.has(mes)) continue;
    lancar.push({ competencia: mes, vencimento, valor: g.valor });
  }
  return lancar;
}

/**
 * Próximo mês ainda sem cobrança (a partir de hoje): é nele que um reajuste aplicado
 * manualmente passa a valer.
 */
export function proximoMesACobrar(
  m: Pick<DadosMensalidade, "dataInicio" | "dia" | "dataCadastro" | "reativadoEm">,
  competenciasExistentes: Set<Mes>,
  hoje: DataISO,
): Mes {
  const piso = [m.dataInicio, m.dataCadastro, m.reativadoEm ?? "", hoje].sort().at(-1)!;
  let mes = primeiroMes(m.dataInicio, m.dia);
  while (vencimentoNoMes(mes, m.dia) < piso || competenciasExistentes.has(mes)) {
    mes = somarMesesCompetencia(mes, 1);
  }
  return mes;
}

/** Aniversário de reajuste cuja data já chegou e que ainda não foi aplicado (aguardando índice). */
export function reajustePendente(
  m: Pick<DadosMensalidade, "dataInicio" | "dia" | "dataCadastro">,
  aniversariosAplicados: Set<number>,
  hoje: DataISO,
): { aniversario: number; mesAniversario: Mes; vencimento: DataISO } | null {
  const proximo = proximoReajuste(m, aniversariosAplicados);
  if (proximo.vencimento > hoje) return null;
  return { aniversario: proximo.aniversario, mesAniversario: mesDe(proximo.vencimento), vencimento: proximo.vencimento };
}
