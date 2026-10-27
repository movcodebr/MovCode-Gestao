import type { z } from "zod";

/** Estado devolvido pelas ações de formulário (Server Actions). */
export type EstadoFormulario = {
  erro?: string;
  sucesso?: string;
  /** Erro de cada campo, pelo nome do campo */
  campos?: Record<string, string>;
  /** Valores digitados, para o formulário não apagá-los quando há erro */
  valores?: Record<string, string>;
};

/** Lê os campos de texto de um FormData. */
export function valoresDoFormulario(dados: FormData): Record<string, string> {
  const valores: Record<string, string> = {};
  for (const [chave, valor] of dados.entries()) {
    if (typeof valor === "string" && !chave.startsWith("$")) valores[chave] = valor;
  }
  return valores;
}

/** Converte os erros do zod em { campo: mensagem } (primeira mensagem de cada campo). */
export function errosPorCampo(erro: z.ZodError): Record<string, string> {
  const campos: Record<string, string> = {};
  for (const issue of erro.issues) {
    const campo = String(issue.path[0] ?? "");
    if (campo && !campos[campo]) campos[campo] = issue.message;
  }
  return campos;
}

type ErroBanco = { code?: string; message?: string } | null | undefined;

/** Traduz erros do banco para mensagens claras. */
export function mensagemErroBanco(erro: ErroBanco, mensagens: { duplicado?: string; emUso?: string } = {}): string {
  switch (erro?.code) {
    case "23505":
      return mensagens.duplicado ?? "Já existe um registro com esses dados.";
    case "23503":
      return mensagens.emUso ?? "Este registro está em uso e não pode ser excluído.";
    case "23514":
      return "Algum dado está inválido. Confira os campos e tente de novo.";
    default:
      return "Não foi possível salvar. Tente de novo em instantes.";
  }
}
