import type { Metadata } from "next";
import { Cartao, Etiqueta, Mensagem, TituloPagina } from "@/components/ui";
import { MANTER_DIARIOS, MANTER_MENSAIS } from "@/lib/dominio/backup";
import { formatarTamanho } from "@/lib/dominio/documentos";
import { criarClienteSupabase } from "@/lib/supabase/servidor";
import { restaurarDaLista, restaurarDeArquivo } from "./acoes";
import { FazerBackup } from "./FazerBackup";
import { Restaurar } from "./Restaurar";

export const metadata: Metadata = { title: "Backup — Mov Code" };

const formato = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" });

export default async function PaginaBackup() {
  const supabase = await criarClienteSupabase();
  const [{ data: backups, error }, { data: usuarios }] = await Promise.all([
    supabase.from("backups").select("*").order("criado_em", { ascending: false }),
    supabase.from("usuarios").select("id, nome"),
  ]);
  const nome = new Map((usuarios ?? []).map((u) => [u.id, u.nome]));

  return (
    <>
      <TituloPagina
        descricao={`Backup automático todo dia às 9h (guarda os ${MANTER_DIARIOS} mais recentes) e um por mês (guarda ${MANTER_MENSAIS} meses, com cópia por e-mail).`}
      >
        Backup
      </TituloPagina>
      <div className="mb-6 grid gap-4 lg:grid-cols-2">
        <Cartao className="flex flex-col gap-3">
          <h2 className="font-semibold">Fazer backup agora</h2>
          <p className="text-sm text-texto-secundario">Útil antes de uma mudança grande. Os arquivos da tela Documentos não entram no backup.</p>
          <FazerBackup />
        </Cartao>
        <Cartao className="flex flex-col gap-3">
          <h2 className="font-semibold">Restaurar de um arquivo</h2>
          <p className="text-sm text-texto-secundario">Use o arquivo baixado desta tela ou o anexo do e-mail do backup mensal.</p>
          <Restaurar
            comArquivo
            rotulo="Escolher arquivo e restaurar"
            descricao="Restaurar a partir de um arquivo de backup do computador."
            acao={restaurarDeArquivo}
          />
        </Cartao>
      </div>

      {error && <Mensagem tipo="erro">Não foi possível carregar os backups.</Mensagem>}
      <ul className="divide-y divide-borda overflow-hidden rounded-2xl border border-borda">
        {backups?.map((b) => (
          <li key={b.id} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0 text-sm">
              <p className="flex flex-wrap items-center gap-2 font-medium">
                {formato.format(new Date(b.criado_em))}
                {b.tipo === "mensal" ? <Etiqueta cor="verde">Mensal</Etiqueta> : <Etiqueta cor="cinza">Diário</Etiqueta>}
                {b.caminho.includes("antes-da-restauracao") && <Etiqueta cor="amarelo">Antes de uma restauração</Etiqueta>}
                {b.caminho.includes("-manual") && <Etiqueta cor="cinza">Manual</Etiqueta>}
              </p>
              <p className="text-texto-secundario">
                {formatarTamanho(b.tamanho_bytes)}
                {b.enviado_por_email && " · cópia enviada por e-mail"}
                {b.restaurado_em &&
                  ` · restaurado em ${formato.format(new Date(b.restaurado_em))} por ${nome.get(b.restaurado_por) ?? "usuário"}`}
              </p>
            </div>
            <div className="flex flex-wrap items-start gap-2">
              <a
                href={`/api/backups/${b.id}`}
                className="rounded-full border border-borda px-3 py-1.5 text-xs font-medium hover:border-destaque hover:text-destaque"
              >
                Baixar
              </a>
              <Restaurar
                descricao={`Restaurar o backup de ${formato.format(new Date(b.criado_em))}.`}
                acao={restaurarDaLista.bind(null, b.id)}
              />
            </div>
          </li>
        ))}
        {backups?.length === 0 && (
          <li className="px-4 py-6 text-center text-texto-secundario">Nenhum backup ainda. O primeiro sai na próxima rotina das 9h.</li>
        )}
      </ul>
    </>
  );
}
