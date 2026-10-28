"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";
import { usuarioAtual } from "@/lib/auth";
import { andamentoDe } from "@/lib/consultas/prospeccao";
import {
  type AcaoLead,
  ACOES,
  aplicarAcao,
  CAMPOS_TEXTO,
  ETAPAS,
  type Etapa,
  esquemaConfiguracao,
  esquemaLeadManual,
  mudarEtapa,
} from "@/lib/dominio/prospeccao";
import { type EstadoFormulario, errosPorCampo, mensagemErroBanco, valoresDoFormulario } from "@/lib/formulario";
import { importarDoPainel } from "@/lib/servicos/prospeccao";
import { criarClienteSupabase } from "@/lib/supabase/servidor";

/** Resultado das ações que salvam sozinhas (sem formulário). */
export type Resultado = { erro?: string };

const DESATUALIZADA = "Esse lead mudou desde que a tela abriu. A tela foi atualizada: confira e tente de novo.";

async function lerAndamento(supabase: SupabaseClient, id: string) {
  const { data } = await supabase
    .from("leads")
    .select("etapa, proximo_followup, followups_enviados, abordado_em, respondeu_em, responsavel_id")
    .eq("id", id)
    .maybeSingle();
  return data ? andamentoDe(data) : null;
}

async function gravar(supabase: SupabaseClient, id: string, mudancas: Record<string, unknown>): Promise<Resultado> {
  const { error } = await supabase.from("leads").update(mudancas).eq("id", id);
  if (error) return { erro: mensagemErroBanco(error) };
  revalidatePath("/prospeccao", "layout");
  return {};
}

/** Cadastra um lead à mão (o resto dos dados pode ser preenchido depois). */
export async function adicionarLead(_: EstadoFormulario, dados: FormData): Promise<EstadoFormulario> {
  await usuarioAtual();
  const valores = valoresDoFormulario(dados);
  const resultado = esquemaLeadManual.safeParse(valores);
  if (!resultado.success) return { campos: errosPorCampo(resultado.error), valores };
  const supabase = await criarClienteSupabase();
  const { data: config } = await supabase.from("prospeccao_config").select("cidades").single();
  const { data, error } = await supabase
    .from("leads")
    .insert({
      ...resultado.data,
      cidade: config?.cidades?.[0] ?? "",
      site_situacao: "não verificado",
      motivo: "Adicionado manualmente.",
      fonte: "manual",
    })
    .select("id")
    .single();
  if (error || !data) {
    if (error?.code === "23505") return { campos: { instagram: "Esse @ já está na lista." }, valores };
    return { erro: mensagemErroBanco(error), valores };
  }
  revalidatePath("/prospeccao", "layout");
  redirect(`/prospeccao/${data.id}`);
}

/**
 * "Enviei a mensagem", "Enviei o follow-up" ou "Quer ver a prévia".
 * Só grava se o lead ainda está como a tela mostrava (evita contar um follow-up duas vezes).
 */
export async function registrarAcao(id: string, acao: AcaoLead): Promise<Resultado> {
  const usuario = await usuarioAtual();
  if (!(acao in ACOES)) return { erro: "Ação inválida." };
  const supabase = await criarClienteSupabase();
  const lead = await lerAndamento(supabase, id);
  if (!lead) return { erro: "Lead não encontrado." };
  const mudancas = aplicarAcao(acao, lead, usuario.id, new Date());
  revalidatePath("/prospeccao", "layout");
  if (!mudancas) return { erro: DESATUALIZADA };
  const { data, error } = await supabase
    .from("leads")
    .update(mudancas)
    .eq("id", id)
    .eq("etapa", lead.etapa)
    .eq("followups_enviados", lead.followupsEnviados)
    .select("id");
  if (error) return { erro: mensagemErroBanco(error) };
  return data.length === 0 ? { erro: DESATUALIZADA } : {};
}

/** Salva um dos textos do lead (mensagens prontas ou anotações). */
export async function salvarTexto(id: string, campo: string, texto: string): Promise<Resultado> {
  await usuarioAtual();
  if (!(campo in CAMPOS_TEXTO) && campo !== "notas") return { erro: "Campo inválido." };
  return gravar(await criarClienteSupabase(), id, { [campo]: String(texto).slice(0, 5000) });
}

export async function mudarEtapaLead(id: string, etapa: Etapa): Promise<Resultado> {
  await usuarioAtual();
  if (!(etapa in ETAPAS)) return { erro: "Etapa inválida." };
  const supabase = await criarClienteSupabase();
  const lead = await lerAndamento(supabase, id);
  if (!lead) return { erro: "Lead não encontrado." };
  return gravar(supabase, id, mudarEtapa(lead, etapa, new Date()));
}

export async function salvarNota(id: string, nota: number): Promise<Resultado> {
  await usuarioAtual();
  if (!Number.isInteger(nota) || nota < 0 || nota > 100) return { erro: "A nota vai de 0 a 100." };
  return gravar(await criarClienteSupabase(), id, { nota });
}

export async function marcarPerfilConferido(id: string, conferido: boolean): Promise<Resultado> {
  await usuarioAtual();
  return gravar(await criarClienteSupabase(), id, { perfil_conferido: conferido === true });
}

/** Assume o lead (fica como responsável) ou libera para o sócio. */
export async function definirResponsavel(id: string, assumir: boolean): Promise<Resultado> {
  const usuario = await usuarioAtual();
  return gravar(await criarClienteSupabase(), id, { responsavel_id: assumir ? usuario.id : null });
}

export async function descartarLead(id: string): Promise<EstadoFormulario> {
  await usuarioAtual();
  const supabase = await criarClienteSupabase();
  const { error } = await supabase.from("leads").delete().eq("id", id);
  if (error) return { erro: mensagemErroBanco(error) };
  revalidatePath("/prospeccao", "layout");
  redirect("/prospeccao/pipeline");
}

/** O que a rotina diária procura: cidades, nichos, quantidade e o jeito das mensagens. */
export async function salvarConfiguracao(_: EstadoFormulario, dados: FormData): Promise<EstadoFormulario> {
  await usuarioAtual();
  const valores = valoresDoFormulario(dados);
  const resultado = esquemaConfiguracao.safeParse(valores);
  if (!resultado.success) return { campos: errosPorCampo(resultado.error), valores };
  const supabase = await criarClienteSupabase();
  const { error } = await supabase.from("prospeccao_config").update(resultado.data).eq("id", true);
  if (error) return { erro: mensagemErroBanco(error), valores };
  revalidatePath("/prospeccao", "layout");
  return { sucesso: "Salvo. A próxima busca já usa isso." };
}

/** Importa o arquivo exportado do painel antigo "Prospecção MovCode". */
export async function importarPainelAntigo(_: EstadoFormulario, dados: FormData): Promise<EstadoFormulario> {
  await usuarioAtual();
  const arquivo = dados.get("arquivo");
  if (!(arquivo instanceof File) || arquivo.size === 0) return { erro: "Escolha o arquivo exportado (.json)." };
  try {
    const r = await importarDoPainel(
      await criarClienteSupabase(),
      await arquivo.text(),
      dados.get("configuracao") === "on",
      new Date(),
    );
    revalidatePath("/prospeccao", "layout");
    const partes = [`${r.adicionados.length} leads importados`];
    if (r.jaExistiam.length) partes.push(`${r.jaExistiam.length} já estavam no sistema`);
    if (r.invalidos.length) {
      partes.push(`${r.invalidos.length} com problema (${r.invalidos.slice(0, 3).map((i) => `@${i.instagram}: ${i.erro}`).join("; ")})`);
    }
    if (r.configuracao) partes.push("configuração da busca atualizada");
    return { sucesso: `${partes.join(", ")}.` };
  } catch (erro) {
    return { erro: (erro as Error).message };
  }
}
