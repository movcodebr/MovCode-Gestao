"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { urlDoSite } from "@/lib/env";
import type { EstadoFormulario } from "@/lib/formulario";
import { mensagemErroLogin } from "@/lib/erros-login";
import { destinoSeguro } from "@/lib/rotas";
import { criarClienteSupabase } from "@/lib/supabase/servidor";


const esquemaLogin = z.object({
  email: z.email("Informe um e-mail válido."),
  senha: z.string().min(1, "Informe a senha."),
});

export async function entrar(_: EstadoFormulario, dados: FormData): Promise<EstadoFormulario> {
  const resultado = esquemaLogin.safeParse({ email: dados.get("email"), senha: dados.get("senha") });
  const valores = { email: String(dados.get("email") ?? "") };
  if (!resultado.success) {
    return { erro: resultado.error.issues[0].message, valores };
  }
  const supabase = await criarClienteSupabase();
  const { error } = await supabase.auth.signInWithPassword({
    email: resultado.data.email,
    password: resultado.data.senha,
  });
  if (error) {
    return { erro: mensagemErroLogin(error), valores };
  }
  redirect(destinoSeguro(dados.get("destino")?.toString()));
}

export async function enviarRecuperacao(_: EstadoFormulario, dados: FormData): Promise<EstadoFormulario> {
  const email = z.email().safeParse(dados.get("email"));
  if (!email.success) {
    return { erro: "Informe um e-mail válido.", valores: { email: String(dados.get("email") ?? "") } };
  }
  const supabase = await criarClienteSupabase();
  await supabase.auth.resetPasswordForEmail(email.data, {
    redirectTo: `${urlDoSite()}/auth/confirmar?destino=/redefinir-senha`,
  });
  // Mesma resposta exista ou não o e-mail, para não revelar quem tem acesso
  return { sucesso: "Se esse e-mail tiver acesso ao sistema, você vai receber um link para criar uma nova senha." };
}
