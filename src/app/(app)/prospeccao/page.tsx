import type { Metadata } from "next";
import { Mensagem, TituloPagina } from "@/components/ui";
import { usuarioAtual } from "@/lib/auth";
import { COLUNAS_LISTA, contarPorEtapa, type LeadResumo, nomesDosUsuarios } from "@/lib/consultas/prospeccao";
import { criarClienteSupabase } from "@/lib/supabase/servidor";
import { dataDoMomento, Funil, ListaLeads } from "./Componentes";

export const metadata: Metadata = { title: "Prospecção — Mov Code" };

/** Fila do dia: follow-ups vencidos e os melhores leads novos (meus ou sem responsável). */
export default async function PaginaProspeccao() {
  const usuario = await usuarioAtual();
  const supabase = await criarClienteSupabase();
  const agora = new Date();
  const meusOuLivres = `responsavel_id.is.null,responsavel_id.eq.${usuario.id}`;
  const { data: config } = await supabase
    .from("prospeccao_config")
    .select("leads_por_dia, ultima_busca_em, ultima_busca_adicionados")
    .single();
  const [contagem, nomes, vencidos, novos] = await Promise.all([
    contarPorEtapa(supabase),
    nomesDosUsuarios(supabase),
    supabase
      .from("leads")
      .select(COLUNAS_LISTA)
      .eq("etapa", "abordado")
      .lte("proximo_followup", agora.toISOString())
      .or(meusOuLivres)
      .order("proximo_followup"),
    supabase
      .from("leads")
      .select(COLUNAS_LISTA)
      .eq("etapa", "novo")
      .or(meusOuLivres)
      .order("nota", { ascending: false })
      .order("encontrado_em", { ascending: false })
      .limit(config?.leads_por_dia ?? 8),
  ]);

  const ultimaBusca = config?.ultima_busca_em
    ? `Última busca de leads em ${dataDoMomento(config.ultima_busca_em)}${
        config.ultima_busca_adicionados != null ? ` (+${config.ultima_busca_adicionados})` : ""
      }.`
    : "A busca diária de leads ainda não rodou.";
  const props = { usuarioId: usuario.id, nomes, agora };

  return (
    <>
      <TituloPagina descricao={ultimaBusca}>Prospecção</TituloPagina>
      <Funil contagem={contagem} />
      {(vencidos.error || novos.error) && <Mensagem tipo="erro">Não foi possível carregar os leads.</Mensagem>}

      <section className="mb-8">
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-lg font-semibold">Follow-ups vencidos</h2>
          <span className="text-sm text-texto-secundario">Abordados sem resposta, na data de cobrar</span>
        </div>
        <ListaLeads
          leads={(vencidos.data ?? []) as LeadResumo[]}
          {...props}
          vazio={{
            titulo: "Nada para cobrar hoje",
            texto: "Quando você marcar uma mensagem como enviada, o follow-up aparece aqui na data certa.",
          }}
        />
      </section>

      <section>
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-lg font-semibold">Para abordar hoje</h2>
          <span className="text-sm text-texto-secundario">Leads novos, melhor nota primeiro</span>
        </div>
        <ListaLeads
          leads={(novos.data ?? []) as LeadResumo[]}
          {...props}
          vazio={{
            titulo: "Sem leads novos",
            texto: "A busca diária adiciona leads toda manhã. Você também pode adicionar um na aba Pipeline.",
          }}
        />
      </section>
    </>
  );
}
