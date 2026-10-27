import type { Canal, GrupoLembrete } from "@/lib/dominio/lembretes";
import { type ConfigResend, enviarEmailResend, envioRealAtivo } from "@/lib/servicos/email";
import type { Mensagem } from "./mensagens";

export type ResultadoEnvio = { ok: boolean; erro?: string };

/** Um meio de envio (e-mail, WhatsApp). Cada canal é independente: a falha de um não afeta o outro. */
export type CanalEnvio = {
  canal: Canal;
  modo: "real" | "log";
  enviar(grupo: GrupoLembrete, mensagem: Mensagem, chaveIdempotencia: string): Promise<ResultadoEnvio>;
};

/** E-mail pela API do Resend, com chave de idempotência (um segundo envio igual em 24h é ignorado). */
export function canalEmailResend(config: ConfigResend): CanalEnvio {
  return {
    canal: "email",
    modo: "real",
    enviar: (grupo, mensagem, chave) =>
      enviarEmailResend(config, {
        para: grupo.cliente.email,
        assunto: mensagem.assunto,
        html: mensagem.html,
        texto: mensagem.texto,
        chaveIdempotencia: chave,
      }),
  };
}

/** Modo de desenvolvimento: não envia nada, só registra no log. */
export function canalSomenteLog(canal: Canal): CanalEnvio {
  return {
    canal,
    modo: "log",
    async enviar(grupo, mensagem) {
      console.log(`[lembrete:${canal}:log] para ${grupo.cliente.nome} <${grupo.cliente.email}> — ${mensagem.assunto}`);
      return { ok: true };
    },
  };
}

/**
 * Canais ativos. Envio real só com EMAILS_MODO=real em produção; em qualquer outro caso
 * os lembretes são apenas registrados. O WhatsApp está desativado por decisão do usuário
 * (ver docs/PLANO.md): para ativar, implemente um CanalEnvio com a API WhatsApp Business
 * Cloud e inclua-o aqui.
 */
export function canaisAtivos(env: Record<string, string | undefined> = process.env): CanalEnvio[] {
  if (!envioRealAtivo(env)) return [canalSomenteLog("email")];
  if (!env.RESEND_API_KEY || !env.EMAIL_REMETENTE || !env.PAGAMENTO_PIX_CHAVE || !env.PAGAMENTO_PIX_NOME) {
    throw new Error("EMAILS_MODO=real exige RESEND_API_KEY, EMAIL_REMETENTE, PAGAMENTO_PIX_CHAVE e PAGAMENTO_PIX_NOME.");
  }
  return [
    canalEmailResend({
      apiKey: env.RESEND_API_KEY,
      remetente: env.EMAIL_REMETENTE,
      responderPara: env.EMAIL_RESPONDER_PARA ?? env.EMAIL_REMETENTE,
    }),
  ];
}
