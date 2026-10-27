import type { SupabaseClient } from "@supabase/supabase-js";
import { type DataISO } from "@/lib/dominio/datas";
import type { Mes } from "@/lib/dominio/reajuste";
import type { CanalEnvio } from "@/lib/lembretes/canais";
import type { DadosPagamento } from "@/lib/lembretes/mensagens";
import { gerarCobrancas, gerarGastosRecorrentes } from "./cobrancas";
import { type EnviarEmailBackup, rotinaBackup } from "./backup";
import { executarLembretes } from "./lembretes";
import { atualizarIpca, carregarIpca } from "./ipca-bcb";

export type ResultadoEtapa = { etapa: string; ok: boolean; detalhes?: unknown; erro?: string };

async function etapa(nome: string, fn: () => Promise<unknown>): Promise<ResultadoEtapa> {
  try {
    return { etapa: nome, ok: true, detalhes: await fn() };
  } catch (erro) {
    return { etapa: nome, ok: false, erro: (erro as Error).message };
  }
}

/**
 * Rotina diária (9h de Brasília). A falha de uma etapa não impede as seguintes.
 * 1) IPCA do Banco Central  2) cobranças das mensalidades (com reajustes)  3) gastos recorrentes
 * 4) lembretes de cobrança (depois das cobranças, para incluir as que vencem hoje)
 * 5) backup diário (e o mensal, com cópia por e-mail, na primeira rotina do mês)
 */
export async function executarTarefaDiaria(
  supabase: SupabaseClient,
  hoje: DataISO,
  opcoes: {
    buscar?: typeof fetch;
    canais?: () => CanalEnvio[];
    pagamento?: DadosPagamento;
    emailBackup?: EnviarEmailBackup;
  } = {},
): Promise<ResultadoEtapa[]> {
  const buscar = opcoes.buscar ?? fetch;
  const resultados: ResultadoEtapa[] = [];
  resultados.push(await etapa("ipca", () => atualizarIpca(supabase, hoje, buscar)));

  let ipca = new Map<Mes, string>();
  resultados.push(
    await etapa("cobrancas", async () => {
      ipca = await carregarIpca(supabase);
      const r = await gerarCobrancas(supabase, hoje, ipca);
      if (r.erros.length > 0) throw new Error(r.erros.join(" | "));
      return r;
    }),
  );
  resultados.push(
    await etapa("gastos_recorrentes", async () => {
      const r = await gerarGastosRecorrentes(supabase, hoje);
      if (r.erros.length > 0) throw new Error(r.erros.join(" | "));
      return r;
    }),
  );
  resultados.push(
    await etapa("lembretes", async () => {
      if (!opcoes.canais || !opcoes.pagamento) throw new Error("Canais e dados de pagamento não configurados.");
      const r = await executarLembretes(supabase, hoje, opcoes.canais(), opcoes.pagamento);
      if (r.falhas > 0) throw new Error(r.erros.join(" | "));
      return r;
    }),
  );
  resultados.push(
    await etapa("backup", async () => {
      if (!opcoes.emailBackup) throw new Error("Envio do backup mensal não configurado.");
      return rotinaBackup(supabase, hoje, opcoes.emailBackup);
    }),
  );
  return resultados;
}
