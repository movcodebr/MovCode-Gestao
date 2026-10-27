import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { supabaseChavePublica, supabaseUrl } from "@/lib/env";

/**
 * Cliente Supabase com a sessão do usuário logado (respeita o RLS).
 * Use em Server Components, Server Actions e Route Handlers.
 */
export async function criarClienteSupabase() {
  const cookieStore = await cookies();
  return createServerClient(supabaseUrl(), supabaseChavePublica(), {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (cookiesParaGravar) => {
        try {
          for (const { name, value, options } of cookiesParaGravar) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Server Components não podem gravar cookies; o proxy renova a sessão.
        }
      },
    },
  });
}
