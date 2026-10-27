import "server-only";
import { createClient } from "@supabase/supabase-js";
import { supabaseUrl, variavel } from "@/lib/env";

/**
 * Cliente com a chave de serviço: ignora o RLS. Uso EXCLUSIVO no servidor,
 * em tarefas automáticas (rotina diária, backup). Nunca em telas.
 */
export function criarClienteAdmin() {
  return createClient(supabaseUrl(), variavel("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
