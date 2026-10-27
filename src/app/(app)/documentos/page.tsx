import type { Metadata } from "next";
import { ConfirmarAcao } from "@/components/ConfirmarAcao";
import { Mensagem, TituloPagina } from "@/components/ui";
import { formatarTamanho } from "@/lib/dominio/documentos";
import { criarClienteSupabase } from "@/lib/supabase/servidor";
import { excluirDocumento } from "./acoes";
import { EnviarDocumento } from "./EnviarDocumento";

export const metadata: Metadata = { title: "Documentos — Mov Code" };

const formatoData = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" });

export default async function PaginaDocumentos() {
  const supabase = await criarClienteSupabase();
  const [{ data: documentos, error }, { data: usuarios }] = await Promise.all([
    supabase.from("documentos").select("id, nome, tamanho_bytes, enviado_por, criado_em").order("criado_em", { ascending: false }),
    supabase.from("usuarios").select("id, nome"),
  ]);
  const nome = new Map((usuarios ?? []).map((u) => [u.id, u.nome]));

  return (
    <>
      <TituloPagina descricao="Arquivos internos guardados na nuvem, visíveis só para quem está logado.">Documentos</TituloPagina>
      <div className="mb-6">
        <EnviarDocumento />
      </div>
      {error && <Mensagem tipo="erro">Não foi possível carregar os documentos.</Mensagem>}
      <ul className="divide-y divide-borda overflow-hidden rounded-2xl border border-borda">
        {documentos?.map((d) => (
          <li key={d.id} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <a
                href={`/api/documentos/${d.id}?modo=abrir`}
                target="_blank"
                rel="noopener noreferrer"
                className="break-all font-medium hover:text-destaque"
              >
                {d.nome}
              </a>
              <p className="text-sm text-texto-secundario">
                {formatarTamanho(d.tamanho_bytes)} · enviado por {nome.get(d.enviado_por) ?? "usuário"} em{" "}
                {formatoData.format(new Date(d.criado_em))}
              </p>
            </div>
            <div className="flex flex-wrap items-start gap-2">
              <a
                href={`/api/documentos/${d.id}?modo=abrir`}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-full border border-borda px-3 py-1.5 text-xs font-medium hover:border-destaque hover:text-destaque"
              >
                Abrir
              </a>
              <a
                href={`/api/documentos/${d.id}`}
                className="rounded-full border border-borda px-3 py-1.5 text-xs font-medium hover:border-destaque hover:text-destaque"
              >
                Baixar
              </a>
              <ConfirmarAcao
                rotulo="Excluir"
                titulo="Excluir documento?"
                mensagem={`"${d.nome}" será apagado da nuvem. Essa ação não pode ser desfeita.`}
                rotuloConfirmar="Excluir"
                variante="perigo"
                compacto
                acao={excluirDocumento.bind(null, d.id)}
              />
            </div>
          </li>
        ))}
        {documentos?.length === 0 && <li className="px-4 py-6 text-center text-texto-secundario">Nenhum documento enviado ainda.</li>}
      </ul>
    </>
  );
}
