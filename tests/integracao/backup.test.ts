/**
 * Integração do backup com um Supabase de verdade (local). Rode com `npm run test:integracao`.
 */
import { execSync } from "node:child_process";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { beforeAll, describe, expect, it } from "vitest";
import { baixarBackup, restaurarBackup, rotinaBackup } from "@/lib/servicos/backup";

const ativo = process.env.INTEGRACAO === "1";
let admin: SupabaseClient;
const emails: string[] = [];
const emailFalso = async (arquivo: { caminho: string; tamanho: number }, mes: string) => {
  emails.push(`${mes}:${arquivo.caminho}:${arquivo.tamanho > 0}`);
  return { ok: true };
};

function sql(comando: string): string {
  return execSync("docker exec -i db psql -qtA -U postgres -h localhost -d postgres", { input: comando }).toString().trim();
}

describe.skipIf(!ativo)("backup (integração)", () => {
  beforeAll(() => {
    admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
    sql("delete from backups; delete from storage.objects where bucket_id = 'backups';");
    sql("set session_replication_role = replica; delete from lembretes_enviados; delete from reajustes; delete from lancamentos; delete from mensalidades; delete from vendas; delete from pausas_lembrete; delete from clientes;");
    sql("insert into clientes (nome, telefone, email, documento) values ('Backup Teste', '11987654321', 'b@x.com', '52998224725')");
    sql("insert into lancamentos (tipo, descricao, categoria, valor_centavos, forma_pagamento, vencimento) values ('saida', 'Teste', 'servidor', 123, 'pix', '2026-10-01')");
  });

  it("primeira rotina do mês: backup diário + mensal (com e-mail) guardados no Storage", async () => {
    const r = await rotinaBackup(admin, "2026-10-01", emailFalso);
    expect(r).toMatchObject({ diario: "diario/2026-10-01.json.gz", mensal: "mensal/2026-10.json.gz", email: "enviado" });
    expect(emails).toEqual(["2026-10:mensal/2026-10.json.gz:true"]);
    expect(sql("select string_agg(name, ',' order by name) from storage.objects where bucket_id = 'backups'")).toBe(
      "diario/2026-10-01.json.gz,mensal/2026-10.json.gz",
    );
    expect(sql("select enviado_por_email from backups where tipo = 'mensal'")).toBe("t");
  });

  it("no dia seguinte só o diário (o mensal do mês já existe)", async () => {
    const r = await rotinaBackup(admin, "2026-10-02", emailFalso);
    expect(r.mensal).toBeUndefined();
    expect(emails).toHaveLength(1);
    expect(sql("select count(*) from backups")).toBe("3");
  });

  it("restaura o backup baixado e guarda antes o estado atual", async () => {
    const conteudo = await baixarBackup(admin, "diario/2026-10-02.json.gz");
    sql("update clientes set nome = 'Mudou depois'; delete from lancamentos;");
    const usuario = sql("select id from usuarios limit 1");
    const r = await restaurarBackup(admin, conteudo, usuario, "2026-10-02", "10:00:00");
    expect(r.contagem).toMatchObject({ clientes: 1, lancamentos: 1 });
    expect(sql("select nome from clientes")).toBe("Backup Teste");
    expect(sql("select descricao from lancamentos")).toBe("Teste");
    expect(r.backupAnterior).toBe("diario/2026-10-02-100000-antes-da-restauracao.json.gz");
    expect(sql(`select count(*) from storage.objects where name = '${r.backupAnterior}'`)).toBe("1");
  });

  it("os arquivos de backup não são acessíveis sem a chave de serviço", async () => {
    const anon = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
    const { data } = await anon.storage.from("backups").download("diario/2026-10-01.json.gz");
    expect(data).toBeNull();
  });
});
