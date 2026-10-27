import type { SupabaseClient } from "@supabase/supabase-js";
import type { DataISO } from "@/lib/dominio/datas";
import { type Mes, somarMesesCompetencia } from "@/lib/dominio/reajuste";

/** API pública do Banco Central (SGS), série 433 = IPCA, variação mensal em %. */
const URL_SGS = "https://api.bcb.gov.br/dados/serie/bcdata.sgs.433/dados";

type PontoSgs = { data: string; valor: string };

/** Converte a resposta do SGS ([{ data: "01/03/2026", valor: "0.56" }]) em { "2026-03": "0.56" }. */
export function lerRespostaSgs(json: unknown): Map<Mes, string> {
  if (!Array.isArray(json)) throw new Error("Resposta inesperada do Banco Central.");
  const mapa = new Map<Mes, string>();
  for (const ponto of json as PontoSgs[]) {
    const data = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(String(ponto?.data ?? ""));
    const valor = String(ponto?.valor ?? "").trim();
    if (!data || !/^-?\d+(\.\d+)?$/.test(valor)) throw new Error("Resposta inesperada do Banco Central.");
    mapa.set(`${data[3]}-${data[2]}`, valor);
  }
  return mapa;
}

function dataSgs(mes: Mes): string {
  const [ano, m] = mes.split("-");
  return `01/${m}/${ano}`;
}

/** Busca os últimos 30 meses de IPCA no Banco Central. */
export async function buscarIpcaBcb(hoje: DataISO, buscar: typeof fetch = fetch): Promise<Map<Mes, string>> {
  const fim = hoje.slice(0, 7);
  const inicio = somarMesesCompetencia(fim, -30);
  const url = `${URL_SGS}?formato=json&dataInicial=${dataSgs(inicio)}&dataFinal=${dataSgs(fim)}`;
  let resposta: Response;
  try {
    resposta = await buscar(url, { signal: AbortSignal.timeout(20_000), cache: "no-store" });
  } catch (erro) {
    throw new Error(`Não foi possível acessar o Banco Central (${(erro as Error).message}).`);
  }
  if (!resposta.ok) throw new Error(`Banco Central respondeu ${resposta.status}.`);
  return lerRespostaSgs(await resposta.json());
}

/** Atualiza o cache local (tabela ipca_mensal) com os dados do Banco Central. */
export async function atualizarIpca(
  supabase: SupabaseClient,
  hoje: DataISO,
  buscar: typeof fetch = fetch,
): Promise<{ meses: number }> {
  const dados = await buscarIpcaBcb(hoje, buscar);
  const linhas = [...dados].map(([mes, valor]) => ({
    competencia: `${mes}-01`,
    variacao_percentual: valor,
    fonte: "bcb",
  }));
  if (linhas.length > 0) {
    const { error } = await supabase.from("ipca_mensal").upsert(linhas, { onConflict: "competencia" });
    if (error) throw new Error(`Não foi possível gravar o IPCA: ${error.message}`);
  }
  return { meses: linhas.length };
}

/** IPCA mensal guardado no banco, por mês. */
export async function carregarIpca(supabase: SupabaseClient): Promise<Map<Mes, string>> {
  const { data, error } = await supabase.from("ipca_mensal").select("competencia, variacao_percentual");
  if (error) throw new Error(`Não foi possível ler o IPCA: ${error.message}`);
  return new Map((data ?? []).map((l) => [String(l.competencia).slice(0, 7), String(l.variacao_percentual)]));
}
