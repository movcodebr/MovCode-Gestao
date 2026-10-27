import { createBrowserClient } from "@supabase/ssr";

/** Cliente Supabase no navegador (usa a sessão do usuário logado; respeita o RLS). */
export function criarClienteNavegador() {
  return createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
}
