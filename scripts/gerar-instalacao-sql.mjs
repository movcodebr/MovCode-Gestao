/**
 * Junta todas as migrações (supabase/migrations) num único arquivo,
 * supabase/instalacao-completa.sql, para colar de uma vez no SQL Editor do Supabase.
 *
 * Uso: npm run gerar-instalacao-sql   (rode sempre que criar uma migração nova)
 */
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const pasta = join(import.meta.dirname, "../supabase/migrations");
const arquivos = readdirSync(pasta).filter((n) => n.endsWith(".sql")).sort();

export function gerarInstalacao() {
  const partes = arquivos.map((nome) => `-- >>> ${nome}\n${readFileSync(join(pasta, nome), "utf8").trim()}\n`);
  return `-- =====================================================================
-- Mov Code — Gestão: instalação completa do banco (gerado automaticamente)
-- Cole TUDO no SQL Editor do Supabase e clique em Run, uma única vez,
-- num projeto novo. Não edite este arquivo: ele é gerado a partir de
-- supabase/migrations com "npm run gerar-instalacao-sql".
-- =====================================================================

${partes.join("\n")}`;
}

if (process.argv[1] && import.meta.filename === process.argv[1]) {
  writeFileSync(join(import.meta.dirname, "../supabase/instalacao-completa.sql"), gerarInstalacao());
  console.log(`Gerado supabase/instalacao-completa.sql com ${arquivos.length} migrações.`);
}
