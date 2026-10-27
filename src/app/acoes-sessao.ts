"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { usuarioAtual } from "@/lib/auth";
import { criarClienteSupabase } from "@/lib/supabase/servidor";
import type { EstadoFormulario } from "./(publico)/acoes";

const esquemaSenha = z
  .object({
    senha: z.string().min(8, "A senha precisa ter pelo menos 8 caracteres."),
    confirmacao: z.string(),
  })
  .refine((d) => d.senha === d.confirmacao, { message: "As senhas não conferem." });

export async function redefinirSenha(_: EstadoFormulario, dados: FormData): Promise<EstadoFormulario> {
  await usuarioAtual();
  const resultado = esquemaSenha.safeParse({ senha: dados.get("senha"), confirmacao: dados.get("confirmacao") });
  if (!resultado.success) {
    return { erro: resultado.error.issues[0].message };
  }
  const supabase = await criarClienteSupabase();
  const { error } = await supabase.auth.updateUser({ password: resultado.data.senha });
  if (error) {
    return { erro: "Não foi possível alterar a senha. Tente uma senha diferente." };
  }
  await supabase.auth.signOut();
  redirect("/login?aviso=senha-alterada");
}

export async function sair(): Promise<void> {
  const supabase = await criarClienteSupabase();
  await supabase.auth.signOut();
  redirect("/login?aviso=saiu");
}
