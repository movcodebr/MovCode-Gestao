import { baixarBackup } from "@/lib/servicos/backup";
import { criarClienteAdmin } from "@/lib/supabase/admin";
import { criarClienteSupabase } from "@/lib/supabase/servidor";

/** Baixa um arquivo de backup (só para usuários logados). */
export async function GET(_: Request, { params }: RouteContext<"/api/backups/[id]">) {
  const { id } = await params;
  const supabase = await criarClienteSupabase();
  const { data: sessao } = await supabase.auth.getClaims();
  if (!sessao?.claims?.sub) return new Response("Não autorizado", { status: 401 });
  // A lista de backups é visível ao usuário logado (RLS); o arquivo, só com a chave de serviço
  const { data: backup } = await supabase.from("backups").select("caminho").eq("id", id).maybeSingle();
  if (!backup) return new Response("Backup não encontrado", { status: 404 });
  const conteudo = await baixarBackup(criarClienteAdmin(), backup.caminho);
  const nome = `backup-movcode-${backup.caminho.replace(/^.*\//, "")}`;
  return new Response(new Uint8Array(conteudo), {
    headers: {
      "Content-Type": "application/gzip",
      "Content-Disposition": `attachment; filename="${nome}"`,
      "Cache-Control": "no-store",
    },
  });
}
