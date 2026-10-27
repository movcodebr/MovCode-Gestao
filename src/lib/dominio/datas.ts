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
