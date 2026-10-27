import { createBrowserClient } from "@supabase/ssr";
import { supabaseChavePublica, supabaseUrl } from "@/lib/env";

/** Cliente Supabase no navegador (usa a sessão do usuário logado; respeita o RLS). */
export function criarClienteNavegador() {
  return createBrowserClient(supabaseUrl(), supabaseChavePublica());
}
