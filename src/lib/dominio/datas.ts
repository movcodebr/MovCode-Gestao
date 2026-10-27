/**
 * Datas do sistema: sempre "AAAA-MM-DD" (sem horário) no fuso de Brasília.
 * Trabalhar com texto evita erros de fuso horário ao virar o dia.
 */
export type DataISO = string;

export const FUSO = "America/Sao_Paulo";

/** Data de hoje em Brasília, no formato AAAA-MM-DD. */
export function hojeEmBrasilia(agora: Date = new Date()): DataISO {
  return new Intl.DateTimeFormat("en-CA", { timeZone: FUSO }).format(agora);
}

/** "2026-03-20" → "20/03/2026" */
export function formatarData(data: DataISO): string {
  const [ano, mes, dia] = data.slice(0, 10).split("-");
  return `${dia}/${mes}/${ano}`;
}

/** Verifica se o texto é uma data real no formato AAAA-MM-DD (ex.: recusa 2026-02-30). */
export function dataValida(texto: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(texto)) return false;
  const [ano, mes, dia] = texto.split("-").map(Number);
  return mes >= 1 && mes <= 12 && dia >= 1 && dia <= ultimoDiaDoMes(ano, mes);
}

/** Último dia do mês (mes de 1 a 12), considerando anos bissextos. */
export function ultimoDiaDoMes(ano: number, mes: number): number {
  return new Date(Date.UTC(ano, mes, 0)).getUTCDate();
}

function doisDigitos(n: number): string {
  return String(n).padStart(2, "0");
}

export function montarData(ano: number, mes: number, dia: number): DataISO {
  return `${ano}-${doisDigitos(mes)}-${doisDigitos(dia)}`;
}

export type TipoPeriodo = "mes" | "trimestre" | "ano";

/** Primeiro e último dia do mês, trimestre ou ano que contém a data de referência. */
export function intervaloDoPeriodo(tipo: TipoPeriodo, referencia: DataISO): { inicio: DataISO; fim: DataISO } {
  const [ano, mes] = referencia.split("-").map(Number);
  const [mesInicio, mesFim] =
    tipo === "mes" ? [mes, mes] : tipo === "trimestre" ? [mes - ((mes - 1) % 3), mes - ((mes - 1) % 3) + 2] : [1, 12];
  return { inicio: montarData(ano, mesInicio, 1), fim: montarData(ano, mesFim, ultimoDiaDoMes(ano, mesFim)) };
}

/** Nome do período para exibição: "março de 2026", "1º trimestre de 2026", "2026". */
export function nomeDoPeriodo(tipo: TipoPeriodo, referencia: DataISO): string {
  const [ano, mes] = referencia.split("-").map(Number);
  if (tipo === "ano") return String(ano);
  if (tipo === "trimestre") return `${Math.ceil(mes / 3)}º trimestre de ${ano}`;
  const nome = new Intl.DateTimeFormat("pt-BR", { month: "long", timeZone: "UTC" }).format(Date.UTC(ano, mes - 1, 1));
  return `${nome} de ${ano}`;
}

/** Desloca a referência em N períodos (para os botões "anterior" e "próximo"). */
export function deslocarPeriodo(tipo: TipoPeriodo, referencia: DataISO, passos: number): DataISO {
  const [ano, mes] = referencia.split("-").map(Number);
  const meses = tipo === "mes" ? 1 : tipo === "trimestre" ? 3 : 12;
  const total = ano * 12 + (mes - 1) + passos * meses;
  return montarData(Math.floor(total / 12), (total % 12) + 1, 1);
}

/** Soma N meses mantendo o dia; se o mês for mais curto, usa o último dia (31/01 + 1 mês = 28/02). */
export function adicionarMeses(data: DataISO, meses: number): DataISO {
  const [ano, mes, dia] = data.split("-").map(Number);
  const total = ano * 12 + (mes - 1) + meses;
  const novoAno = Math.floor(total / 12);
  const novoMes = (total % 12) + 1;
  return montarData(novoAno, novoMes, Math.min(dia, ultimoDiaDoMes(novoAno, novoMes)));
}
