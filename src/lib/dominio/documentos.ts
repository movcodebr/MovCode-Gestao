/** Limite por arquivo do plano gratuito do Supabase Storage. */
export const TAMANHO_MAXIMO_DOCUMENTO = 50 * 1024 * 1024;

/** Nome seguro para o caminho no Storage (sem acentos, espaços ou caracteres especiais). */
export function nomeSeguro(nome: string): string {
  const semAcento = nome.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const limpo = semAcento
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/\.{2,}/g, ".")
    .replace(/-+/g, "-")
    .replace(/^[-.]+|-+$/g, "");
  return (limpo || "arquivo").slice(0, 120);
}

/** Caminho do arquivo no Storage: pasta única por envio, para nomes iguais não se sobrescreverem. */
export function caminhoDocumento(id: string, nome: string): string {
  return `${id}/${nomeSeguro(nome)}`;
}

export function formatarTamanho(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} KB`;
  return `${(bytes / 1024 / 1024).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} MB`;
}
