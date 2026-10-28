import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Andamento, Etapa } from "@/lib/dominio/prospeccao";

/** Colunas usadas nas listas de leads. */
export const COLUNAS_LISTA =
  "id, instagram, nome, nicho, site_situacao, nota, etapa, proximo_followup, followups_enviados, responsavel_id";

export type LeadResumo = {
  id: string;
  instagram: string;
  nome: string;
  nicho: string;
  site_situacao: string;
  nota: number;
  etapa: Etapa;
  proximo_followup: string | null;
  followups_enviados: number;
  responsavel_id: string | null;
};

export function andamentoDe(lead: {
  etapa: Etapa;
  proximo_followup: string | null;
  followups_enviados: number;
  abordado_em?: string | null;
  respondeu_em?: string | null;
  responsavel_id: string | null;
}): Andamento {
  return {
    etapa: lead.etapa,
    proximoFollowup: lead.proximo_followup,
    followupsEnviados: lead.followups_enviados,
    abordadoEm: lead.abordado_em ?? null,
    respondeuEm: lead.respondeu_em ?? null,
    responsavelId: lead.responsavel_id,
  };
}

/** Quantos leads há em cada etapa do funil. */
export async function contarPorEtapa(supabase: SupabaseClient): Promise<Partial<Record<Etapa, number>>> {
  const { data } = await supabase.from("v_leads_por_etapa").select("etapa, quantidade");
  return Object.fromEntries((data ?? []).map((l) => [l.etapa, l.quantidade]));
}

/** Nome de cada usuário (os sócios), para mostrar o responsável pelo lead. */
export async function nomesDosUsuarios(supabase: SupabaseClient): Promise<Record<string, string>> {
  const { data } = await supabase.from("usuarios").select("id, nome");
  return Object.fromEntries((data ?? []).map((u) => [u.id, u.nome]));
}

/** "você" para o próprio usuário; o primeiro nome do sócio para os demais. */
export function nomeDoResponsavel(id: string | null, usuarioId: string, nomes: Record<string, string>): string {
  if (!id) return "";
  if (id === usuarioId) return "você";
  return nomes[id]?.split(" ")[0] || "sócio";
}
