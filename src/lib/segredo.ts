import { timingSafeEqual } from "node:crypto";

/**
 * Confere o cabeçalho "Authorization: Bearer <segredo>" das chamadas automáticas
 * (rotina diária, rotina de prospecção). Sem segredo configurado, ninguém entra.
 */
export function autorizacaoConfere(recebido: string | null, segredo: string | undefined): boolean {
  if (!segredo) return false;
  const esperado = Buffer.from(`Bearer ${segredo}`);
  const atual = Buffer.from(recebido ?? "");
  return esperado.length === atual.length && timingSafeEqual(esperado, atual);
}
