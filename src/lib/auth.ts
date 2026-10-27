import "server-only";
import { redirect } from "next/navigation";
import { cache } from "react";
import { criarClienteSupabase } from "@/lib/supabase/servidor";

export type Usuario = { id: string; nome: string; email: string };

/**
 * Devolve o usuário logado ou manda para o login.
 * Toda tela interna e toda ação de gravação deve passar por aqui.
 */
export const usuarioAtual = cache(async (): Promise<Usuario> => {
  const supabase = await criarClienteSupabase();
  const { data, error } = await supabase.auth.getClaims();
  const id = data?.claims?.sub;
  if (error || !id) {
    redirect("/login");
  }
  const { data: perfil } = await supabase.from("usuarios").select("nome, email").eq("id", id).single();
  return {
    id,
    nome: perfil?.nome ?? String(data.claims.email ?? ""),
    email: perfil?.email ?? String(data.claims.email ?? ""),
  };
});
