"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { usuarioAtual } from "@/lib/auth";
import { hojeEmBrasilia } from "@/lib/dominio/datas";
import {
  esquemaEdicaoLancamento,
  esquemaGasto,
  esquemaGastoRecorrente,
  esquemaPagamento,
  esquemaVenda,
} from "@/lib/dominio/lancamentos";
import { type EstadoFormulario, errosPorCampo, mensagemErroBanco, valoresDoFormulario } from "@/lib/formulario";
import { criarClienteSupabase } from "@/lib/supabase/servidor";

function atualizarTelas() {
  revalidatePath("/financeiro", "layout");
  revalidatePath("/clientes", "layout");
}

/** Erros levantados pelas regras do banco (raise exception) já vêm com mensagem pronta. */
function mensagemDaRegra(erro: { code?: string; message?: string } | null): string {
  return erro?.code === "P0001" && erro.message ? erro.message : mensagemErroBanco(erro);
}

/** Lança uma venda: venda única (com parcelas), mensalidade ou as duas, numa única transação. */
export async function registrarVenda(_: EstadoFormulario, dados: FormData): Promise<EstadoFormulario> {
  await usuarioAtual();
  let bruto: unknown;
  try {
    bruto = JSON.parse(String(dados.get("venda") ?? ""));
  } catch {
    return { erro: "Não foi possível ler o formulário. Recarregue a página e tente de novo." };
  }
  const resultado = esquemaVenda.safeParse(bruto);
  if (!resultado.success) {
    return { erro: resultado.error.issues[0].message, campos: errosPorCampo(resultado.error) };
  }
  const venda = resultado.data;

  // O valor de tabela vem sempre do banco, nunca do navegador.
  const supabase = await criarClienteSupabase();
  const { data: produto } = await supabase
    .from("produtos")
    .select("preco_centavos, mensalidade_centavos")
    .eq("id", venda.produto_id)
    .single();
  if (!produto) return { erro: "Produto não encontrado." };

  const { error } = await supabase.rpc("registrar_venda", {
    p: {
      cliente_id: venda.cliente_id,
      produto_id: venda.produto_id,
      data_venda: venda.data_venda,
      unica: venda.unica ? { ...venda.unica, valor_tabela: produto.preco_centavos } : null,
      mensalidade: venda.mensalidade ? { ...venda.mensalidade, valor_tabela: produto.mensalidade_centavos } : null,
    },
  });
  if (error) return { erro: mensagemDaRegra(error) };
  atualizarTelas();
  redirect("/financeiro/lancamentos?aviso=venda");
}

/** Lança um gasto avulso ou cria um gasto recorrente mensal. */
export async function registrarGasto(_: EstadoFormulario, dados: FormData): Promise<EstadoFormulario> {
  await usuarioAtual();
  const valores = valoresDoFormulario(dados);
  const resultado = esquemaGasto.safeParse(valores);
  if (!resultado.success) return { campos: errosPorCampo(resultado.error), valores };
  const g = resultado.data;
  const supabase = await criarClienteSupabase();

  const { error } =
    g.recorrente === "sim"
      ? await supabase.from("gastos_recorrentes").insert({
          descricao: g.descricao,
          categoria: g.categoria,
          valor_centavos: g.valor,
          forma_pagamento: g.forma_pagamento,
          dia_vencimento: Number(g.vencimento.slice(8, 10)),
          data_inicio: g.vencimento,
          data_fim: g.data_fim || null,
        })
      : await supabase.from("lancamentos").insert({
          tipo: "saida",
          descricao: g.descricao,
          categoria: g.categoria,
          valor_centavos: g.valor,
          forma_pagamento: g.forma_pagamento,
          vencimento: g.vencimento,
        });
  if (error) return { erro: mensagemErroBanco(error), valores };
  atualizarTelas();
  redirect(g.recorrente === "sim" ? "/financeiro/gastos/recorrentes?aviso=criado" : "/financeiro/lancamentos?aviso=gasto");
}

/** Edita um lançamento (o banco registra quem editou e o que mudou). */
export async function salvarLancamento(id: string, _: EstadoFormulario, dados: FormData): Promise<EstadoFormulario> {
  await usuarioAtual();
  const valores = valoresDoFormulario(dados);
  const resultado = esquemaEdicaoLancamento.safeParse(valores);
  if (!resultado.success) return { campos: errosPorCampo(resultado.error), valores };
  const l = resultado.data;
  const supabase = await criarClienteSupabase();
  const { error } = await supabase
    .from("lancamentos")
    .update({
      descricao: l.descricao,
      valor_centavos: l.valor,
      forma_pagamento: l.forma_pagamento,
      vencimento: l.vencimento,
      status: l.status,
      data_pagamento: l.data_pagamento,
      ...(l.categoria ? { categoria: l.categoria } : {}),
    })
    .eq("id", id)
    .is("excluido_em", null);
  if (error) return { erro: mensagemErroBanco(error), valores };
  atualizarTelas();
  redirect(`/financeiro/lancamentos/${id}?aviso=salvo`);
}

/** Dá baixa: marca como pago com a data e a forma de pagamento. */
export async function marcarComoPago(id: string, _: EstadoFormulario, dados: FormData): Promise<EstadoFormulario> {
  await usuarioAtual();
  const resultado = esquemaPagamento.safeParse(valoresDoFormulario(dados));
  if (!resultado.success) return { erro: resultado.error.issues[0].message };
  const supabase = await criarClienteSupabase();
  const { error } = await supabase
    .from("lancamentos")
    .update({ status: "pago", ...resultado.data })
    .eq("id", id)
    .is("excluido_em", null);
  if (error) return { erro: mensagemErroBanco(error) };
  atualizarTelas();
  return { sucesso: "Pagamento registrado." };
}

/** Exclusão lógica: o lançamento sai das telas e dos cálculos, mas fica no histórico. */
export async function excluirLancamento(id: string): Promise<EstadoFormulario> {
  await usuarioAtual();
  const supabase = await criarClienteSupabase();
  const { error } = await supabase
    .from("lancamentos")
    .update({ excluido_em: new Date().toISOString() })
    .eq("id", id)
    .is("excluido_em", null);
  if (error) return { erro: mensagemErroBanco(error) };
  atualizarTelas();
  redirect("/financeiro/lancamentos?aviso=excluido");
}

/** Edita um gasto recorrente: o novo valor vale só para os meses seguintes. */
export async function salvarGastoRecorrente(
  id: string,
  _: EstadoFormulario,
  dados: FormData,
): Promise<EstadoFormulario> {
  await usuarioAtual();
  const valores = valoresDoFormulario(dados);
  const resultado = esquemaGastoRecorrente.safeParse(valores);
  if (!resultado.success) return { campos: errosPorCampo(resultado.error), valores };
  const g = resultado.data;
  const supabase = await criarClienteSupabase();
  const { error } = await supabase
    .from("gastos_recorrentes")
    .update({
      descricao: g.descricao,
      categoria: g.categoria,
      valor_centavos: g.valor,
      forma_pagamento: g.forma_pagamento,
      data_fim: g.data_fim || null,
    })
    .eq("id", id);
  if (error) {
    return {
      erro: error.code === "23514" ? "A data final precisa ser depois do início." : mensagemErroBanco(error),
      valores,
    };
  }
  atualizarTelas();
  redirect("/financeiro/gastos/recorrentes?aviso=salvo");
}

/** Encerra a recorrência: não gera mais gastos a partir de hoje; os já gerados continuam. */
export async function encerrarGastoRecorrente(id: string): Promise<EstadoFormulario> {
  const usuario = await usuarioAtual();
  const supabase = await criarClienteSupabase();
  const { error } = await supabase
    .from("gastos_recorrentes")
    .update({ encerrado_em: hojeEmBrasilia(), encerrado_por: usuario.id })
    .eq("id", id)
    .is("encerrado_em", null);
  if (error) return { erro: mensagemErroBanco(error) };
  atualizarTelas();
  redirect("/financeiro/gastos/recorrentes?aviso=encerrado");
}
