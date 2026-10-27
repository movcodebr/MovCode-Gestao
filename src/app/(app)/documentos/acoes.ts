"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { usuarioAtual } from "@/lib/auth";
import { TAMANHO_MAXIMO_DOCUMENTO } from "@/lib/dominio/documentos";
import { type EstadoFormulario, mensagemErroBanco } from "@/lib/formulario";
import { criarClienteSupabase } from "@/lib/supabase/servidor";

const esquemaDocumento = z.object({
  caminho: z.string().regex(/^[0-9a-f-]{36}\/[a-zA-Z0-9._-]{1,120}$/, "Caminho inválido."),
  nome: z.string().trim().min(1).max(200),
  tamanho: z.number().int().min(0).max(TAMANHO_MAXIMO_DOCUMENTO),
  tipo: z.string().max(200).nullable(),
});

/** Registra um arquivo que o navegador acabou de enviar ao Storage. */
export async function registrarDocumento(dados: z.input<typeof esquemaDocumento>): Promise<EstadoFormulario> {
  const usuario = await usuarioAtual();
  const r = esquemaDocumento.safeParse(dados);
  if (!r.success) return { erro: "Dados do arquivo inválidos." };
  const supabase = await criarClienteSupabase();
  const { error } = await supabase.from("documentos").insert({
    nome: r.data.nome,
    caminho: r.data.caminho,
    tamanho_bytes: r.data.tamanho,
    tipo_mime: r.data.tipo,
    enviado_por: usuario.id,
  });
  if (error) {
    await supabase.storage.from("documentos").remove([r.data.caminho]);
    return { erro: mensagemErroBanco(error) };
  }
  revalidatePath("/documentos");
  return { sucesso: `"${r.data.nome}" enviado.` };
}

/** Exclui o arquivo do Storage e o registro. */
export async function excluirDocumento(id: string): Promise<EstadoFormulario> {
  await usuarioAtual();
  const supabase = await criarClienteSupabase();
  const { data: doc } = await supabase.from("documentos").select("caminho").eq("id", id).single();
  if (!doc) return { erro: "Documento não encontrado." };
  const { error: erroArquivo } = await supabase.storage.from("documentos").remove([doc.caminho]);
  if (erroArquivo) return { erro: "Não foi possível excluir o arquivo. Tente de novo." };
  const { error } = await supabase.from("documentos").delete().eq("id", id);
  if (error) return { erro: mensagemErroBanco(error) };
  revalidatePath("/documentos");
  return { sucesso: "Documento excluído." };
}
