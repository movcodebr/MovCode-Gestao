import type { Metadata } from "next";
import { Botao, Mensagem, Selecao, TituloPagina } from "@/components/ui";
import { usuarioAtual } from "@/lib/auth";
import { COLUNAS_LISTA, contarPorEtapa, type LeadResumo, nomesDosUsuarios } from "@/lib/consultas/prospeccao";
import { ETAPAS } from "@/lib/dominio/prospeccao";
import { criarClienteSupabase } from "@/lib/supabase/servidor";
import { AdicionarLead } from "./AdicionarLead";
import { Funil, ListaLeads } from "../Componentes";

export const metadata: Metadata = { title: "Pipeline — Prospecção — Mov Code" };

const RESPONSAVEIS = { todos: "Todos", meus: "Meus leads", livres: "Sem responsável", outros: "Do sócio" } as const;
const LIMITE = 300;

/** Remove caracteres que têm significado especial nos filtros do Supabase. */
function limparBusca(texto: string): string {
  return texto.replace(/[,()*%\\]/g, " ").trim();
}

export default async function PaginaPipeline({ searchParams }: PageProps<"/prospeccao/pipeline">) {
  const usuario = await usuarioAtual();
  const params = await searchParams;
  const busca = typeof params.busca === "string" ? limparBusca(params.busca) : "";
  const etapa = typeof params.etapa === "string" && params.etapa in ETAPAS ? params.etapa : "todas";
  const responsavel = (
    typeof params.responsavel === "string" && params.responsavel in RESPONSAVEIS ? params.responsavel : "todos"
  ) as keyof typeof RESPONSAVEIS;

  const supabase = await criarClienteSupabase();
  let consulta = supabase
    .from("leads")
    .select(COLUNAS_LISTA)
    .order("atualizado_em", { ascending: false, nullsFirst: false })
    .order("encontrado_em", { ascending: false })
    .limit(LIMITE);
  if (etapa !== "todas") consulta = consulta.eq("etapa", etapa);
  if (responsavel === "meus") consulta = consulta.eq("responsavel_id", usuario.id);
  if (responsavel === "livres") consulta = consulta.is("responsavel_id", null);
  if (responsavel === "outros") consulta = consulta.neq("responsavel_id", usuario.id);
  if (busca) {
    consulta = consulta.or(["nome", "instagram", "nicho", "cidade"].map((c) => `${c}.ilike.*${busca}*`).join(","));
  }
  const [{ data: leads, error }, contagem, nomes] = await Promise.all([
    consulta,
    contarPorEtapa(supabase),
    nomesDosUsuarios(supabase),
  ]);

  return (
    <>
      <TituloPagina descricao="Todos os leads, os mexidos por último primeiro.">Pipeline</TituloPagina>
      <Funil contagem={contagem} />

      <form className="mb-6 grid gap-3 sm:grid-cols-[1fr_auto_auto_auto] sm:items-end">
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="text-texto-secundario">Buscar</span>
          <input
            name="busca"
            defaultValue={busca}
            placeholder="Nome, @, nicho ou cidade"
            className="rounded-lg border border-borda bg-superficie px-3 py-2.5 text-base outline-none focus:border-destaque"
          />
        </label>
        <Selecao rotulo="Etapa" name="etapa" defaultValue={etapa}>
          <option value="todas">Todas</option>
          {Object.entries(ETAPAS).map(([valor, rotulo]) => (
            <option key={valor} value={valor}>
              {rotulo}
            </option>
          ))}
        </Selecao>
        <Selecao rotulo="Responsável" name="responsavel" defaultValue={responsavel}>
          {Object.entries(RESPONSAVEIS).map(([valor, rotulo]) => (
            <option key={valor} value={valor}>
              {rotulo}
            </option>
          ))}
        </Selecao>
        <Botao type="submit" variante="secundario">
          Filtrar
        </Botao>
      </form>

      {error && <Mensagem tipo="erro">Não foi possível carregar os leads.</Mensagem>}
      <ListaLeads
        leads={(leads ?? []) as LeadResumo[]}
        usuarioId={usuario.id}
        nomes={nomes}
        agora={new Date()}
        vazio={{ titulo: "Nenhum lead aqui", texto: "Troque o filtro ou adicione um lead abaixo." }}
      />
      {leads?.length === LIMITE && (
        <p className="mt-2 text-sm text-texto-secundario">
          Mostrando os {LIMITE} mais recentes. Use a busca ou os filtros para achar os outros.
        </p>
      )}

      <section className="mt-10">
        <h2 className="mb-3 text-lg font-semibold">Adicionar lead à mão</h2>
        <AdicionarLead />
      </section>
    </>
  );
}
