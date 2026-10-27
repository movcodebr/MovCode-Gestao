"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { usuarioAtual } from "@/lib/auth";
import { esquemaProduto } from "@/lib/dominio/cadastros";
import { type EstadoFormulario, errosPorCampo, mensagemErroBanco, valoresDoFormulario } from "@/lib/formulario";
import { criarClienteSupabase } from "@/lib/supabase/servidor";

const DUPLICADO = "Já existe um produto com esse nome.";

/** Cadastra (id nulo) ou edita um produto. Mudar o preço vale só para vendas novas. */
export async function salvarProduto(
  id: string | null,
  _: EstadoFormulario,
  dados: FormData,
): Promise<EstadoFormulario> {
  await usuarioAtual();
  const valores = valoresDoFormulario(dados);
  const resultado = esquemaProduto.safeParse(valores);
  if (!resultado.success) {
    return { campos: errosPorCampo(resultado.error), valores };
  }
  const registro = {
    nome: resultado.data.nome,
    preco_centavos: resultado.data.preco,
    mensalidade_centavos: resultado.data.mensalidade,
  };
  const supabase = await criarClienteSupabase();
  const { error } = id
    ? await supabase.from("produtos").update(registro).eq("id", id)
    : await supabase.from("produtos").insert(registro);
  if (error) {
    return { erro: mensagemErroBanco(error, { duplicado: DUPLICADO }), valores };
  }
  revalidatePath("/produtos");
  redirect("/produtos");
}

/** Desativa (some das vendas novas) ou reativa um produto. */
export async function alterarAtivoProduto(id: string, ativo: boolean): Promise<EstadoFormulario> {
  await usuarioAtual();
  const supabase = await criarClienteSupabase();
  const { error } = await supabase.from("produtos").update({ ativo }).eq("id", id);
  if (error) return { erro: mensagemErroBanco(error) };
  revalidatePath("/produtos");
  redirect("/produtos");
}

/** Exclui um produto nunca usado em vendas; se já foi usado, orienta a desativar. */
export async function excluirProduto(id: string): Promise<EstadoFormulario> {
  await usuarioAtual();
  const supabase = await criarClienteSupabase();
  const { error } = await supabase.from("produtos").delete().eq("id", id);
  if (error) {
    return {
      erro: mensagemErroBanco(error, {
        emUso: "Este produto já foi usado em vendas e não pode ser excluído. Use \"Desativar\" para tirá-lo das vendas novas.",
      }),
    };
  }
  revalidatePath("/produtos");
  redirect("/produtos");
}
