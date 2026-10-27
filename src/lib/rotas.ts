/** Rotas que podem ser abertas sem login. */
export const ROTAS_PUBLICAS = ["/login", "/esqueci-senha", "/auth/confirmar", "/api/cron"];

export function rotaPublica(caminho: string): boolean {
  return ROTAS_PUBLICAS.some((rota) => caminho === rota || caminho.startsWith(`${rota}/`));
}

/**
 * Aceita apenas caminhos internos ("/inicio"), nunca endereços externos
 * ("//site.com", "https://..."), para evitar redirecionamento malicioso.
 */
export function destinoSeguro(destino: string | null | undefined, padrao = "/inicio"): string {
  if (!destino || !destino.startsWith("/") || destino.startsWith("//") || destino.includes("\\")) {
    return padrao;
  }
  return destino;
}
