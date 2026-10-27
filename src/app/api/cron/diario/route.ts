import { timingSafeEqual } from "node:crypto";
import { type NextRequest, NextResponse } from "next/server";
import { hojeEmBrasilia } from "@/lib/dominio/datas";
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
  const etapas = await executarTarefaDiaria(criarClienteAdmin(), hoje);
  const ok = etapas.every((e) => e.ok);
  console.log(JSON.stringify({ rotina: "diaria", hoje, ok, etapas }));
  return NextResponse.json({ hoje, ok, etapas }, { status: ok ? 200 : 500 });
}
