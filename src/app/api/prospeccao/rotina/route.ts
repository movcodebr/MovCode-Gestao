import { type NextRequest, NextResponse } from "next/server";
import { autorizacaoConfere } from "@/lib/segredo";
import { dadosParaRotina, gravarLeadsDaRotina, MAXIMO_POR_ENVIO } from "@/lib/servicos/prospeccao";
import { criarClienteAdmin } from "@/lib/supabase/admin";

/**
 * Usada pela rotina de busca de leads (tarefa agendada do Claude), com o
 * cabeçalho "Authorization: Bearer PROSPECCAO_TOKEN".
 * GET: configuração da busca, @ já cadastrados e follow-ups vencidos.
 * POST { leads: [...] }: grava os leads novos (os já existentes são ignorados).
 */
function autorizado(request: NextRequest): boolean {
  return autorizacaoConfere(request.headers.get("authorization"), process.env.PROSPECCAO_TOKEN);
}

export async function GET(request: NextRequest) {
  if (!autorizado(request)) return NextResponse.json({ erro: "Não autorizado" }, { status: 401 });
  try {
    return NextResponse.json(await dadosParaRotina(criarClienteAdmin(), new Date()));
  } catch (erro) {
    return NextResponse.json({ erro: (erro as Error).message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  if (!autorizado(request)) return NextResponse.json({ erro: "Não autorizado" }, { status: 401 });
  const corpo: unknown = await request.json().catch(() => null);
  const leads = (corpo as { leads?: unknown } | null)?.leads;
  if (!Array.isArray(leads) || leads.length > MAXIMO_POR_ENVIO) {
    return NextResponse.json(
      { erro: `Envie um JSON { "leads": [...] } com no máximo ${MAXIMO_POR_ENVIO} leads.` },
      { status: 400 },
    );
  }
  try {
    const resultado = await gravarLeadsDaRotina(criarClienteAdmin(), leads, new Date());
    console.log(JSON.stringify({ rotina: "prospeccao", adicionados: resultado.adicionados.length, invalidos: resultado.invalidos.length }));
    return NextResponse.json(resultado);
  } catch (erro) {
    return NextResponse.json({ erro: (erro as Error).message }, { status: 500 });
  }
}
