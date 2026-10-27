"use server";

import { revalidatePath } from "next/cache";
import { usuarioAtual } from "@/lib/auth";
import { caminhoBackup } from "@/lib/dominio/backup";
import { hojeEmBrasilia } from "@/lib/dominio/datas";
import type { EstadoFormulario } from "@/lib/formulario";
import { baixarBackup, criarBackup, restaurarBackup } from "@/lib/servicos/backup";
import { criarClienteAdmin } from "@/lib/supabase/admin";

const PALAVRA = "RESTAURAR";

function horarioAgora(): string {
  return new Date().toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo", hour12: false });
}

/** Faz um backup na hora (por exemplo, antes de uma mudança grande). */
export async function fazerBackupAgora(): Promise<EstadoFormulario> {
  await usuarioAtual();
  try {
    await criarBackup(criarClienteAdmin(), "diario", caminhoBackup("manual", hojeEmBrasilia(), horarioAgora()));
  } catch (erro) {
    return { erro: (erro as Error).message };
  }
  revalidatePath("/backup");
  return { sucesso: "Backup feito." };
}

function resumo(r: { contagem: Record<string, number>; backupAnterior: string }): string {
  const c = r.contagem;
  return `Dados restaurados: ${c.clientes} clientes, ${c.lancamentos} lançamentos, ${c.mensalidades} mensalidades. Um backup do estado anterior foi guardado (${r.backupAnterior}).`;
}

/** Restaura um backup da lista. Exige digitar RESTAURAR. */
export async function restaurarDaLista(id: string, _: EstadoFormulario, dados: FormData): Promise<EstadoFormulario> {
  const usuario = await usuarioAtual();
  if (String(dados.get("confirmacao") ?? "").trim().toUpperCase() !== PALAVRA) {
    return { erro: `Digite ${PALAVRA} para confirmar.` };
  }
  const admin = criarClienteAdmin();
  const { data: backup } = await admin.from("backups").select("caminho").eq("id", id).single();
  if (!backup) return { erro: "Backup não encontrado." };
  try {
    const conteudo = await baixarBackup(admin, backup.caminho);
    const r = await restaurarBackup(admin, conteudo, usuario.id, hojeEmBrasilia(), horarioAgora(), id);
    revalidatePath("/", "layout");
    return { sucesso: resumo(r) };
  } catch (erro) {
    return { erro: (erro as Error).message };
  }
}

/** Restaura a partir de um arquivo enviado (por exemplo, o anexo do e-mail mensal). */
export async function restaurarDeArquivo(_: EstadoFormulario, dados: FormData): Promise<EstadoFormulario> {
  const usuario = await usuarioAtual();
  if (String(dados.get("confirmacao") ?? "").trim().toUpperCase() !== PALAVRA) {
    return { erro: `Digite ${PALAVRA} para confirmar.` };
  }
  const arquivo = dados.get("arquivo");
  if (!(arquivo instanceof File) || arquivo.size === 0) return { erro: "Escolha o arquivo de backup (.json.gz)." };
  try {
    const r = await restaurarBackup(
      criarClienteAdmin(),
      Buffer.from(await arquivo.arrayBuffer()),
      usuario.id,
      hojeEmBrasilia(),
      horarioAgora(),
    );
    revalidatePath("/", "layout");
    return { sucesso: resumo(r) };
  } catch (erro) {
    return { erro: (erro as Error).message };
  }
}
