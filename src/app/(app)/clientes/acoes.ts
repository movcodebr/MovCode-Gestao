"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { usuarioAtual } from "@/lib/auth";
import { esquemaCliente } from "@/lib/dominio/cadastros";
import { dataValida } from "@/lib/dominio/datas";
import { type EstadoFormulario, errosPorCampo, mensagemErroBanco, valoresDoFormulario } from "@/lib/formulario";
import { criarClienteSupabase } from "@/lib/supabase/servidor";

const DUPLICADO = "Já existe um cliente com esse CPF/CNPJ.";

/** Cadastra (id nulo) ou edita um cliente. O tipo (PF/PJ) é definido pelo banco a partir do documento. */
export async function salvarCliente(
  id: string | null,
  _: EstadoFormulario,
  dados: FormData,
): Promise<EstadoFormulario> {
  await usuarioAtual();
  const valores = valoresDoFormulario(dados);
  const resultado = esquemaCliente.safeParse(valores);
  if (!resultado.success) {
    return { campos: errosPorCampo(resultado.error), valores };
  }
  const { status, ...campos } = resultado.data;
  const registro = { ...campos, ativo: status === "ativo" };
  const supabase = await criarClienteSupabase();
  const { data, error } = id
    ? await supabase.from("clientes").update(registro).eq("id", id).select("id").single()
    : await supabase.from("clientes").insert(registro).select("id").single();
  if (error || !data) {
    if (error?.code === "23505") {
      return { campos: { documento: DUPLICADO }, valores };
    }
    return { erro: mensagemErroBanco(error, { duplicado: DUPLICADO }), valores };
  }
  revalidatePath("/clientes");
  redirect(`/clientes/${data.id}`);
}

/**
 * Inativa (para de gerar cobranças futuras de todas as mensalidades) ou
 * reativa o cliente (cobranças voltam no próximo vencimento, sem retroativo).
 */
export async function alterarStatusCliente(id: string, ativo: boolean): Promise<EstadoFormulario> {
  await usuarioAtual();
  const supabase = await criarClienteSupabase();
  const { error } = await supabase.from("clientes").update({ ativo }).eq("id", id);
  if (error) return { erro: mensagemErroBanco(error) };
  revalidatePath("/clientes");
  redirect(`/clientes/${id}`);
}

/**
 * Cancela uma mensalidade: para de gerar cobranças futuras só dela e sai do MRR.
 * O cliente e as demais mensalidades continuam; cobranças já geradas ficam no histórico.
 */
export async function cancelarMensalidade(id: string, clienteId: string): Promise<EstadoFormulario> {
  await usuarioAtual();
  const supabase = await criarClienteSupabase();
  const { error } = await supabase.from("mensalidades").update({ status: "cancelada" }).eq("id", id).eq("status", "ativa");
  if (error) return { erro: mensagemErroBanco(error) };
  revalidatePath("/clientes");
  revalidatePath("/financeiro", "layout");
  redirect(`/clientes/${clienteId}`);
}

/** Pausa todos os lembretes do cliente até a data final (as cobranças não mudam). */
export async function pausarLembretes(clienteId: string, _: EstadoFormulario, dados: FormData): Promise<EstadoFormulario> {
  await usuarioAtual();
  const fim = String(dados.get("fim") ?? "");
  const motivo = String(dados.get("motivo") ?? "").trim().slice(0, 300);
  if (!dataValida(fim)) return { erro: "Informe a data final da pausa.", valores: { fim, motivo } };
  const supabase = await criarClienteSupabase();
  const { error } = await supabase.rpc("pausar_lembretes", { p_cliente_id: clienteId, p_fim: fim, p_motivo: motivo });
  if (error) {
    return { erro: error.code === "P0001" ? error.message : mensagemErroBanco(error), valores: { fim, motivo } };
  }
  revalidatePath("/clientes", "layout");
  revalidatePath("/financeiro");
  redirect(`/clientes/${clienteId}`);
}

/** Retoma os lembretes antes da data final. Lembretes que cairiam na pausa não são reenviados. */
export async function retomarLembretes(clienteId: string): Promise<EstadoFormulario> {
  await usuarioAtual();
  const supabase = await criarClienteSupabase();
  const { error } = await supabase.rpc("retomar_lembretes", { p_cliente_id: clienteId });
  if (error) return { erro: error.code === "P0001" ? error.message : mensagemErroBanco(error) };
  revalidatePath("/clientes", "layout");
  revalidatePath("/financeiro");
  redirect(`/clientes/${clienteId}`);
}
