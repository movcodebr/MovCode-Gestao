import type { NextRequest } from "next/server";
import { buscarLancamentos, lerFiltros } from "@/lib/consultas/lancamentos";
import { intervaloDoPeriodo, nomeDoPeriodo } from "@/lib/dominio/datas";
import { gerarExcel, gerarPdf } from "@/lib/servicos/exportacao";
import { criarClienteSupabase } from "@/lib/supabase/servidor";

/** Exporta os lançamentos com os mesmos filtros da tela (para o contador). */
export async function GET(request: NextRequest, { params }: RouteContext<"/api/exportar/[formato]">) {
  const { formato } = await params;
  if (formato !== "xlsx" && formato !== "pdf") return new Response("Formato inválido", { status: 404 });

  const supabase = await criarClienteSupabase();
  const { data: sessao } = await supabase.auth.getClaims();
  if (!sessao?.claims?.sub) return new Response("Não autorizado", { status: 401 });
  const { data: usuario } = await supabase.from("usuarios").select("nome").eq("id", sessao.claims.sub).single();

  const filtros = lerFiltros(Object.fromEntries(request.nextUrl.searchParams));
  const { linhas, erro } = await buscarLancamentos(supabase, filtros);
  if (erro) return new Response("Não foi possível carregar os lançamentos", { status: 500 });

  const { inicio } = intervaloDoPeriodo(filtros.periodo, filtros.ref);
  const nomePeriodo = nomeDoPeriodo(filtros.periodo, filtros.ref);
  const titulo = `Mov Code — Lançamentos — ${nomePeriodo}`;
  const arquivo = `lancamentos-${filtros.periodo}-${inicio}.${formato}`;

  const conteudo =
    formato === "xlsx" ? await gerarExcel(linhas, titulo) : await gerarPdf(linhas, titulo, usuario?.nome ?? "usuário");
  return new Response(new Uint8Array(conteudo), {
    headers: {
      "Content-Type":
        formato === "xlsx" ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" : "application/pdf",
      "Content-Disposition": `attachment; filename="${arquivo}"`,
      "Cache-Control": "no-store",
    },
  });
}
