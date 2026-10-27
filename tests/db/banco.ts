import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";

const PASTA_MIGRACOES = join(__dirname, "../../supabase/migrations");

/**
 * Reproduz o mínimo do ambiente Supabase (papéis, schema auth e auth.uid())
 * para que as migrações rodem num Postgres em memória.
 */
const AMBIENTE_SUPABASE = `
  create role anon nologin;
  create role authenticated nologin;
  create role service_role nologin bypassrls;
  create schema auth;
  create table auth.users (
    id uuid primary key default gen_random_uuid(),
    email text not null,
    raw_user_meta_data jsonb not null default '{}'
  );
  create function auth.uid() returns uuid language sql stable as $$
    select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
  $$;
  grant usage on schema public, auth to anon, authenticated, service_role;
  grant execute on function auth.uid() to anon, authenticated, service_role;
  alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
  alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
  alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
`;

export type Banco = PGlite;

/** Cria um banco novo com todas as migrações aplicadas, na ordem. */
export async function criarBanco(): Promise<Banco> {
  const db = new PGlite();
  await db.exec(AMBIENTE_SUPABASE);
  const arquivos = readdirSync(PASTA_MIGRACOES)
    .filter((nome) => nome.endsWith(".sql"))
    .sort();
  for (const arquivo of arquivos) {
    try {
      await db.exec(readFileSync(join(PASTA_MIGRACOES, arquivo), "utf8"));
    } catch (erro) {
      throw new Error(`Falha ao aplicar ${arquivo}: ${(erro as Error).message}`);
    }
  }
  return db;
}

/** Cria um usuário no "Auth" e devolve o id. */
export async function criarUsuario(db: Banco, email: string, nome: string): Promise<string> {
  const { rows } = await db.query<{ id: string }>(
    "insert into auth.users (email, raw_user_meta_data) values ($1, $2) returning id",
    [email, JSON.stringify({ nome })],
  );
  return rows[0].id;
}

/** Executa como um usuário logado (papel authenticated, com auth.uid() = id). */
export async function comoUsuario<T>(db: Banco, usuarioId: string, fn: () => Promise<T>): Promise<T> {
  await db.query("select set_config('request.jwt.claim.sub', $1, false)", [usuarioId]);
  await db.exec("set role authenticated");
  try {
    return await fn();
  } finally {
    await db.exec("reset role");
    await db.query("select set_config('request.jwt.claim.sub', '', false)");
  }
}

/** Executa como visitante não logado (papel anon). */
export async function comoAnonimo<T>(db: Banco, fn: () => Promise<T>): Promise<T> {
  await db.exec("set role anon");
  try {
    return await fn();
  } finally {
    await db.exec("reset role");
  }
}

/** Simula a data de "hoje" (fuso de Brasília) usada pelas regras do banco. */
export async function definirHoje(db: Banco, data: string): Promise<void> {
  await db.query("select set_config('app.hoje', $1, false)", [data]);
}

/** Documentos válidos para usar nos testes. */
export const CPF_VALIDO = "52998224725";
export const CPF_VALIDO_2 = "12345678909";
export const CNPJ_VALIDO = "11222333000181";
export const CNPJ_ALFANUMERICO_VALIDO = "12ABC34501DE35";
