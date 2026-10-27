import { timingSafeEqual } from "node:crypto";
import { type NextRequest, NextResponse } from "next/server";
import { hojeEmBrasilia } from "@/lib/dominio/datas";
import { canaisAtivos } from "@/lib/lembretes/canais";
import { mensagemBackupMensal } from "@/lib/servicos/backup";
import { enviarEmailResend, envioRealAtivo } from "@/lib/servicos/email";
import { criarClienteAdmin } from "@/lib/supabase/admin";
import { executarTarefaDiaria } from "@/lib/servicos/tarefa-diaria";

// Pode levar alguns segundos (API do Banco Central, envio de e-mails)
export const maxDuration = 60;

function autorizado(request: NextRequest): boolean {
  const segredo = process.env.CRON_SECRET;
  const recebido = request.headers.get("authorization") ?? "";
  if (!segredo) return false;
  const esperado = Buffer.from(`Bearer ${segredo}`);
  const atual = Buffer.from(recebido);
  return esperado.length === atual.length && timingSafeEqual(esperado, atual);
}

/** Chamado pela Vercel Cron todo dia às 12:00 UTC (9h de Brasília). */
export async function GET(request: NextRequest) {
  if (!autorizado(request)) {
    return NextResponse.json({ erro: "Não autorizado" }, { status: 401 });
  }
  const hoje = hojeEmBrasilia();
  const etapas = await executarTarefaDiaria(criarClienteAdmin(), hoje, {
    canais: () => canaisAtivos(),
    pagamento: {
      chavePix: process.env.PAGAMENTO_PIX_CHAVE ?? "",
      favorecido: process.env.PAGAMENTO_PIX_NOME ?? "",
    },
    emailBackup: async (arquivo, mes) => {
      const destino = process.env.BACKUP_EMAIL_DESTINO;
      if (!envioRealAtivo()) {
        console.log(`[backup:email:log] backup ${arquivo.caminho} (${arquivo.tamanho} bytes) para ${destino}`);
        return { ok: true };
      }
      if (!destino || !process.env.RESEND_API_KEY || !process.env.EMAIL_REMETENTE) {
        return { ok: false, erro: "Configure BACKUP_EMAIL_DESTINO, RESEND_API_KEY e EMAIL_REMETENTE." };
      }
      const m = mensagemBackupMensal(mes, hoje);
      return enviarEmailResend(
        {
          apiKey: process.env.RESEND_API_KEY,
          remetente: process.env.EMAIL_REMETENTE,
          responderPara: process.env.EMAIL_RESPONDER_PARA ?? process.env.EMAIL_REMETENTE,
        },
        {
          para: destino,
          assunto: m.assunto,
          texto: m.texto,
          html: m.html,
          anexos: [{ nome: `backup-movcode-${mes}.json.gz`, conteudo: arquivo.conteudo }],
          chaveIdempotencia: `backup-mensal-${mes}`,
        },
      );
    },
  });
  const ok = etapas.every((e) => e.ok);
  console.log(JSON.stringify({ rotina: "diaria", hoje, ok, etapas }));
  return NextResponse.json({ hoje, ok, etapas }, { status: ok ? 200 : 500 });
}
