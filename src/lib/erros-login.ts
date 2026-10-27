/**
 * Traduz o erro do login. E-mail inexistente e senha errada têm a mesma mensagem, para não
 * revelar quem tem acesso. Erros de configuração ou conexão aparecem como tal (e vão para o log).
 */
export function mensagemErroLogin(erro: { code?: string; status?: number; message?: string }): string {
  if (erro.code === "invalid_credentials") return "E-mail ou senha incorretos.";
  if (erro.code === "email_not_confirmed") {
    return "Este acesso ainda não foi confirmado. Peça para confirmar o usuário no Supabase (Authentication → Users).";
  }
  if (erro.code === "over_request_rate_limit" || erro.status === 429) {
    return "Muitas tentativas seguidas. Espere alguns minutos e tente de novo.";
  }
  console.error("[login] erro inesperado:", erro.code, erro.status, erro.message);
  return "Não foi possível entrar agora por um problema de configuração ou conexão com o serviço de login. Tente de novo em instantes; se continuar, confira as variáveis do Supabase na Vercel.";
}
