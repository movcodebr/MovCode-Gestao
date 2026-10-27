/** Lê uma variável de ambiente obrigatória, com mensagem clara se faltar. */
export function variavel(nome: string): string {
  const valor = process.env[nome];
  if (!valor) {
    throw new Error(`Variável de ambiente ${nome} não configurada (veja .env.example).`);
  }
  return valor;
}

// Variáveis NEXT_PUBLIC_* precisam ser lidas de forma literal para o Next.js
// conseguir embuti-las no código do navegador.
export function supabaseUrl(): string {
  const valor = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!valor) throw new Error("Variável de ambiente NEXT_PUBLIC_SUPABASE_URL não configurada.");
  return valor;
}

export function supabaseChavePublica(): string {
  const valor = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!valor) throw new Error("Variável de ambiente NEXT_PUBLIC_SUPABASE_ANON_KEY não configurada.");
  return valor;
}

export function urlDoSite(): string {
  return process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
}
