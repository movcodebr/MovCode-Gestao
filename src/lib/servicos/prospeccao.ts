import type { SupabaseClient } from "@supabase/supabase-js";
import { type LinhaLead, lerExportacaoPainel, lerLeads } from "@/lib/dominio/prospeccao";

/** Máximo de leads em cada envio da rotina de busca. */
export const MAXIMO_POR_ENVIO = 30;
const POR_PAGINA = 1000;

/** Grava só os leads cujo @ ainda não existe: um lead existente nunca é regravado. */
async function inserirNovos(db: SupabaseClient, linhas: LinhaLead[]) {
  if (linhas.length === 0) return { adicionados: [] as string[], jaExistiam: [] as string[] };
  const { data, error } = await db
    .from("leads")
    .upsert(linhas, { onConflict: "instagram", ignoreDuplicates: true })
    .select("instagram");
  if (error) throw new Error(`Não foi possível gravar os leads: ${error.message}`);
  const adicionados = (data ?? []).map((l) => l.instagram as string);
  const novos = new Set(adicionados);
  return { adicionados, jaExistiam: linhas.map((l) => l.instagram).filter((i) => !novos.has(i)) };
}

/** O que a rotina de busca precisa ler: configuração, @ já cadastrados e follow-ups vencidos. */
export async function dadosParaRotina(admin: SupabaseClient, agora: Date) {
  const [{ data: config, error }, vencidos] = await Promise.all([
    admin
      .from("prospeccao_config")
      .select("cidades, nichos, leads_por_dia, assinatura, instrucoes, ultima_busca_em, ultima_busca_adicionados")
      .single(),
    admin
      .from("leads")
      .select("id", { count: "exact", head: true })
      .eq("etapa", "abordado")
      .lte("proximo_followup", agora.toISOString()),
  ]);
  if (error || !config) throw new Error(`Não foi possível ler a configuração: ${error?.message}`);
  if (vencidos.error) throw new Error(`Não foi possível contar os follow-ups: ${vencidos.error.message}`);

  const instagrams: string[] = [];
  const leadsPorNicho: Record<string, number> = {};
  for (let de = 0; ; de += POR_PAGINA) {
    const { data, error: erroLista } = await admin
      .from("leads")
      .select("instagram, nicho")
      .order("instagram")
      .range(de, de + POR_PAGINA - 1);
    if (erroLista) throw new Error(`Não foi possível listar os leads: ${erroLista.message}`);
    for (const l of data) {
      instagrams.push(l.instagram);
      if (l.nicho) leadsPorNicho[l.nicho] = (leadsPorNicho[l.nicho] ?? 0) + 1;
    }
    if (data.length < POR_PAGINA) break;
  }

  return {
    config: {
      cidades: config.cidades,
      nichos: config.nichos,
      leadsPorDia: config.leads_por_dia,
      assinatura: config.assinatura,
      instrucoes: config.instrucoes,
    },
    ultimaBusca: { em: config.ultima_busca_em, adicionados: config.ultima_busca_adicionados },
    instagrams,
    leadsPorNicho,
    followupsVencidos: vencidos.count ?? 0,
  };
}

/** Grava os leads encontrados pela rotina (sempre como "novo") e registra a busca. */
export async function gravarLeadsDaRotina(admin: SupabaseClient, lista: unknown[], agora: Date) {
  const { linhas, invalidos } = lerLeads(lista, { manterAndamento: false, agora });
  const resultado = await inserirNovos(admin, linhas);
  const { error } = await admin
    .from("prospeccao_config")
    .update({ ultima_busca_em: agora.toISOString(), ultima_busca_adicionados: resultado.adicionados.length })
    .eq("id", true);
  if (error) throw new Error(`Leads gravados, mas não foi possível registrar a busca: ${error.message}`);
  return { ...resultado, invalidos };
}

/**
 * Importa o arquivo exportado do painel antigo: leads novos com o andamento
 * que tinham e, se pedido, a configuração da busca. Pode ser repetido sem duplicar.
 */
export async function importarDoPainel(db: SupabaseClient, conteudo: string, comConfiguracao: boolean, agora: Date) {
  const lido = lerExportacaoPainel(conteudo, agora);
  const resultado = await inserirNovos(db, lido.linhas);
  let configuracao = false;
  if (comConfiguracao && lido.config) {
    const { error } = await db.from("prospeccao_config").update(lido.config).eq("id", true);
    if (error) throw new Error(`Leads importados, mas a configuração não foi salva: ${error.message}`);
    configuracao = true;
  }
  return { ...resultado, invalidos: lido.invalidos, configuracao };
}
