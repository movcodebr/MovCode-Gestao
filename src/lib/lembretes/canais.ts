import type { Canal, GrupoLembrete } from "@/lib/dominio/lembretes";
import type { Mensagem } from "./mensagens";

export type ResultadoEnvio = { ok: boolean; erro?: string };

/** Um meio de envio (e-mail, WhatsApp). Cada canal é independente: a falha de um não afeta o outro. */
export type CanalEnvio = {
  canal: Canal;
  modo: "real" | "log";
  enviar(grupo: GrupoLembrete, mensagem: Mensagem, chaveIdempotencia: string): Promise<ResultadoEnvio>;
};

/** E-mail pela API do Resend (https://resend.com/docs/api-reference/emails/send-email). */
export function canalEmailResend(config: {
  apiKey: string;
  remetente: string;
  responderPara: string;
  buscar?: typeof fetch;
}): CanalEnvio {
  const buscar = config.buscar ?? fetch;
  return {
    canal: "email",
    modo: "real",
    async enviar(grupo, mensagem, chave) {
      const resposta = await buscar("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${config.apiKey}`,
          "Content-Type": "application/json",
          // O Resend ignora um segundo envio com a mesma chave em 24h
          "Idempotency-Key": chave,
        },
        body: JSON.stringify({
          from: `Mov Code <${config.remetente}>`,
          to: [grupo.cliente.email],
          reply_to: config.responderPara,
          subject: mensagem.assunto,
          html: mensagem.html,
          text: mensagem.texto,
        }),
        signal: AbortSignal.timeout(15_000),
      });
      if (resposta.ok) return { ok: true };
      const corpo = await resposta.text().catch(() => "");
      return { ok: false, erro: `Resend ${resposta.status}: ${corpo.slice(0, 300)}` };
    },
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
 * Canais ativos. Envio real só com LEMBRETES_MODO=real em produção; em qualquer outro caso
 * os lembretes são apenas registrados. O WhatsApp está desativado por decisão do usuário
 * (ver docs/PLANO.md): para ativar, implemente um CanalEnvio com a API WhatsApp Business
 * Cloud e inclua-o aqui.
 */
export function canaisAtivos(env: Record<string, string | undefined> = process.env): CanalEnvio[] {
  const real = env.LEMBRETES_MODO === "real" && env.NODE_ENV === "production";
  if (!real) return [canalSomenteLog("email")];
  if (!env.RESEND_API_KEY || !env.EMAIL_REMETENTE || !env.PAGAMENTO_PIX_CHAVE || !env.PAGAMENTO_PIX_NOME) {
    throw new Error("LEMBRETES_MODO=real exige RESEND_API_KEY, EMAIL_REMETENTE, PAGAMENTO_PIX_CHAVE e PAGAMENTO_PIX_NOME.");
  }
  return [
    canalEmailResend({
      apiKey: env.RESEND_API_KEY,
      remetente: env.EMAIL_REMETENTE,
      responderPara: env.EMAIL_RESPONDER_PARA ?? env.EMAIL_REMETENTE,
    }),
  ];
}
