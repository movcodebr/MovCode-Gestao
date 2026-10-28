/** Rotas que podem ser abertas sem login. */
export const ROTAS_PUBLICAS = ["/login", "/esqueci-senha", "/auth/confirmar", "/api/cron", "/api/prospeccao/rotina"];

export function rotaPublica(caminho: string): boolean {
  return ROTAS_PUBLICAS.some((rota) => caminho === rota || caminho.startsWith(`${rota}/`));
}

/**
 * Aceita apenas caminhos internos ("/inicio"), nunca endereços externos
 * ("//site.com", "https://..."), para evitar redirecionamento malicioso.
 */
export function destinoSeguro(destino: string | null | undefined, padrao = "/inicio"): string {
  // Caracteres de controle (tab, quebra de linha) são descartados pelo navegador:
  // "/\t/golpe.com" viraria "//golpe.com"
  if (!destino || /[\u0000-\u001f\u007f\\]/.test(destino)) return padrao;
  if (!destino.startsWith("/") || destino.startsWith("//")) return padrao;
  return destino;
}
