/** Envio de e-mail pela API do Resend (https://resend.com/docs/api-reference/emails/send-email). */
export type EmailResend = {
  para: string;
  assunto: string;
  html: string;
  texto: string;
  anexos?: { nome: string; conteudo: Buffer }[];
  chaveIdempotencia?: string;
};

export type ConfigResend = { apiKey: string; remetente: string; responderPara: string; buscar?: typeof fetch };

export async function enviarEmailResend(config: ConfigResend, email: EmailResend): Promise<{ ok: boolean; erro?: string }> {
  const buscar = config.buscar ?? fetch;
  const resposta = await buscar("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      "Content-Type": "application/json",
      ...(email.chaveIdempotencia ? { "Idempotency-Key": email.chaveIdempotencia } : {}),
    },
    body: JSON.stringify({
      from: `Mov Code <${config.remetente}>`,
      to: [email.para],
      reply_to: config.responderPara,
      subject: email.assunto,
      html: email.html,
      text: email.texto,
      ...(email.anexos?.length
        ? { attachments: email.anexos.map((a) => ({ filename: a.nome, content: a.conteudo.toString("base64") })) }
        : {}),
    }),
    signal: AbortSignal.timeout(30_000),
  });
  if (resposta.ok) return { ok: true };
  const corpo = await resposta.text().catch(() => "");
  return { ok: false, erro: `Resend ${resposta.status}: ${corpo.slice(0, 300)}` };
}

/** E-mails só saem de verdade com EMAILS_MODO=real em produção. */
export function envioRealAtivo(env: Record<string, string | undefined> = process.env): boolean {
  return env.EMAILS_MODO === "real" && env.NODE_ENV === "production";
}
