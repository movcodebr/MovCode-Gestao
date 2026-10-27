import { gunzipSync } from "node:zlib";
import type { DataISO } from "./datas";

/** Quantos backups ficam guardados (os mais antigos são apagados). */
export const MANTER_DIARIOS = 30;
export const MANTER_MENSAIS = 12;

export type BackupGuardado = { id: string; tipo: "diario" | "mensal"; criadoEm: string };

/** Backups além do limite de retenção (30 diários e 12 mensais mais recentes ficam). */
export function backupsParaApagar(backups: BackupGuardado[]): string[] {
  const apagar: string[] = [];
  for (const [tipo, manter] of [["diario", MANTER_DIARIOS], ["mensal", MANTER_MENSAIS]] as const) {
    const doTipo = backups.filter((b) => b.tipo === tipo).sort((a, b) => b.criadoEm.localeCompare(a.criadoEm));
    apagar.push(...doTipo.slice(manter).map((b) => b.id));
  }
  return apagar;
}

/** Já existe backup mensal deste mês? (o mensal é feito no 1º dia em que a rotina roda no mês) */
export function precisaBackupMensal(caminhosMensais: string[], hoje: DataISO): boolean {
  return !caminhosMensais.includes(caminhoBackup("mensal", hoje));
}

/** Caminho do arquivo no Storage. Backups feitos à mão levam o horário no nome. */
export function caminhoBackup(tipo: "diario" | "mensal" | "manual", hoje: DataISO, horario?: string): string {
  if (tipo === "mensal") return `mensal/${hoje.slice(0, 7)}.json.gz`;
  if (tipo === "manual") return `diario/${hoje}-${(horario ?? "000000").replace(/\D/g, "").slice(0, 6)}-manual.json.gz`;
  return `diario/${hoje}.json.gz`;
}

/** Lê um arquivo de backup (.json ou .json.gz) e confere se é deste sistema. */
export function lerArquivoBackup(conteudo: Buffer): Record<string, unknown> {
  let texto: string;
  try {
    texto = (conteudo[0] === 0x1f && conteudo[1] === 0x8b ? gunzipSync(conteudo) : conteudo).toString("utf8");
  } catch {
    throw new Error("Não foi possível abrir o arquivo de backup.");
  }
  let dados: unknown;
  try {
    dados = JSON.parse(texto);
  } catch {
    throw new Error("O arquivo não é um backup válido (JSON inválido).");
  }
  const b = dados as { sistema?: string; versao?: number; tabelas?: unknown };
  if (b?.sistema !== "movcode-gestao" || b.versao !== 1 || typeof b.tabelas !== "object") {
    throw new Error("O arquivo não é um backup válido deste sistema.");
  }
  return b as Record<string, unknown>;
}
