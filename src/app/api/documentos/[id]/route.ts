import { type NextRequest, NextResponse } from "next/server";
import { criarClienteSupabase } from "@/lib/supabase/servidor";

/**
 * Abre (?modo=abrir) ou baixa (padrão) um documento: gera um link temporário de 60 segundos
 * no Storage privado, só para usuários logados.
 */
export async function GET(request: NextRequest, { params }: RouteContext<"/api/documentos/[id]">) {
  const { id } = await params;
  const supabase = await criarClienteSupabase();
  const { data: sessao } = await supabase.auth.getClaims();
  if (!sessao?.claims?.sub) return new Response("Não autorizado", { status: 401 });

  const { data: doc } = await supabase.from("documentos").select("nome, caminho").eq("id", id).maybeSingle();
  if (!doc) return new Response("Documento não encontrado", { status: 404 });

  const abrir = request.nextUrl.searchParams.get("modo") === "abrir";
  const { data, error } = await supabase.storage
    .from("documentos")
    .createSignedUrl(doc.caminho, 60, abrir ? undefined : { download: doc.nome });
  if (error || !data) return new Response("Não foi possível gerar o link do arquivo", { status: 500 });
  return NextResponse.redirect(data.signedUrl, { headers: { "Cache-Control": "no-store" } });
}
