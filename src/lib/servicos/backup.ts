import { gzipSync } from "node:zlib";
import type { SupabaseClient } from "@supabase/supabase-js";
import { backupsParaApagar, caminhoBackup, lerArquivoBackup, precisaBackupMensal } from "@/lib/dominio/backup";
import { type DataISO, formatarData } from "@/lib/dominio/datas";

const BUCKET = "backups";

export type ArquivoBackup = { id: string; caminho: string; tamanho: number; conteudo: Buffer };

/** Exporta todas as tabelas, compacta e guarda no Storage privado. */
export async function criarBackup(
  admin: SupabaseClient,
  tipo: "diario" | "mensal",
  caminho: string,
): Promise<ArquivoBackup> {
  const { data, error } = await admin.rpc("exportar_backup");
  if (error) throw new Error(`Não foi possível exportar os dados: ${error.message}`);
  const conteudo = gzipSync(JSON.stringify(data));
  const envio = await admin.storage
    .from(BUCKET)
    .upload(caminho, conteudo, { contentType: "application/gzip", upsert: true });
  if (envio.error) throw new Error(`Não foi possível guardar o backup: ${envio.error.message}`);
  const { data: linha, error: erroLinha } = await admin
    .from("backups")
    .upsert({ tipo, caminho, tamanho_bytes: conteudo.length, criado_em: new Date().toISOString() }, { onConflict: "caminho" })
    .select("id")
    .single();
  if (erroLinha || !linha) throw new Error(`Não foi possível registrar o backup: ${erroLinha?.message}`);
  return { id: linha.id, caminho, tamanho: conteudo.length, conteudo };
}

/** Apaga backups além do limite (30 diários, 12 mensais). */
export async function aplicarRetencao(admin: SupabaseClient): Promise<number> {
  const { data } = await admin.from("backups").select("id, tipo, caminho, criado_em");
  const todos = data ?? [];
  const apagar = new Set(backupsParaApagar(todos.map((b) => ({ id: b.id, tipo: b.tipo, criadoEm: b.criado_em }))));
  if (apagar.size === 0) return 0;
  const alvo = todos.filter((b) => apagar.has(b.id));
  await admin.storage.from(BUCKET).remove(alvo.map((b) => b.caminho));
  await admin.from("backups").delete().in("id", [...apagar]);
  return apagar.size;
}

export type EnviarEmailBackup = (arquivo: ArquivoBackup, mes: string) => Promise<{ ok: boolean; erro?: string }>;

/** Etapa da rotina diária: backup do dia, backup do mês (com cópia por e-mail) e retenção. */
export async function rotinaBackup(admin: SupabaseClient, hoje: DataISO, enviarEmail: EnviarEmailBackup) {
  const diario = await criarBackup(admin, "diario", caminhoBackup("diario", hoje));
  const resultado: { diario: string; mensal?: string; email?: string; apagados: number } = { diario: diario.caminho, apagados: 0 };

  const { data: mensais } = await admin.from("backups").select("caminho").eq("tipo", "mensal");
  if (precisaBackupMensal((mensais ?? []).map((m) => m.caminho), hoje)) {
    const mensal = await criarBackup(admin, "mensal", caminhoBackup("mensal", hoje));
    resultado.mensal = mensal.caminho;
    const envio = await enviarEmail(mensal, hoje.slice(0, 7));
    resultado.email = envio.ok ? "enviado" : `falhou: ${envio.erro}`;
    if (envio.ok) await admin.from("backups").update({ enviado_por_email: true }).eq("id", mensal.id);
    else throw new Error(`Backup mensal guardado, mas o e-mail falhou: ${envio.erro}`);
  }
  resultado.apagados = await aplicarRetencao(admin);
  return resultado;
}

/** Texto do e-mail que leva o backup mensal em anexo. */
export function mensagemBackupMensal(mes: string, hoje: DataISO) {
  const [ano, m] = mes.split("-");
  const assunto = `Backup mensal Mov Code — ${m}/${ano}`;
  const texto = `Segue em anexo o backup mensal do sistema de gestão da Mov Code, gerado em ${formatarData(hoje)}.

Guarde este e-mail: o arquivo pode ser usado na tela Backup do sistema (opção "Restaurar de um arquivo") para recuperar os dados.

Os arquivos da tela Documentos não vão no backup.`;
  return { assunto, texto, html: `<pre style="font-family:Arial,Helvetica,sans-serif;white-space:pre-wrap">${texto}</pre>` };
}

/**
 * Restaura um backup. Antes, guarda automaticamente um backup do estado atual
 * ("antes-da-restauracao"), para poder desfazer.
 */
export async function restaurarBackup(
  admin: SupabaseClient,
  conteudo: Buffer,
  usuarioId: string,
  hoje: DataISO,
  horario: string,
  backupId?: string,
) {
  const dados = lerArquivoBackup(conteudo);
  const seguranca = await criarBackup(
    admin,
    "diario",
    caminhoBackup("manual", hoje, horario).replace("-manual", "-antes-da-restauracao"),
  );
  const { data, error } = await admin.rpc("restaurar_backup", { p: dados });
  if (error) throw new Error(error.code === "P0001" ? error.message : `A restauração falhou e nada foi alterado: ${error.message}`);
  if (backupId) {
    await admin.from("backups").update({ restaurado_em: new Date().toISOString(), restaurado_por: usuarioId }).eq("id", backupId);
  }
  return { contagem: data as Record<string, number>, backupAnterior: seguranca.caminho };
}

/** Baixa o conteúdo de um backup guardado. */
export async function baixarBackup(admin: SupabaseClient, caminho: string): Promise<Buffer> {
  const { data, error } = await admin.storage.from(BUCKET).download(caminho);
  if (error || !data) throw new Error("Não foi possível baixar o backup.");
  return Buffer.from(await data.arrayBuffer());
}
