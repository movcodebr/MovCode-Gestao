import "server-only";
import { hojeEmBrasilia, intervaloDoPeriodo, montarData, type TipoPeriodo } from "@/lib/dominio/datas";
import type { CategoriaGasto, FormaPagamento, StatusLancamento } from "@/lib/dominio/lancamentos";
import type { criarClienteSupabase } from "@/lib/supabase/servidor";

export type FiltrosLancamentos = {
  periodo: TipoPeriodo;
  ref: string;
  tipo: "todos" | "entrada" | "saida";
  status: "todos" | StatusLancamento;
  categoria: "todas" | CategoriaGasto;
  cliente: string;
};

export type LinhaLancamento = {
  id: string;
  tipo: "entrada" | "saida";
  descricao: string;
  valor_centavos: number;
  forma_pagamento: FormaPagamento;
  vencimento: string;
  data_pagamento: string | null;
  status_efetivo: StatusLancamento;
  dias_atraso: number;
  categoria: CategoriaGasto | null;
  cliente_id: string | null;
  mensalidade_id: string | null;
  gasto_recorrente_id: string | null;
  cliente_nome: string | null;
};

type Parametros = Record<string, string | string[] | undefined>;

function texto(p: Parametros, chave: string): string | undefined {
  const v = p[chave];
  return typeof v === "string" ? v : undefined;
}

function umDe<T extends string>(valor: string | undefined, opcoes: readonly T[], padrao: T): T {
  return opcoes.includes(valor as T) ? (valor as T) : padrao;
}

/** Lê os filtros da URL, com valores padrão seguros. */
export function lerFiltros(p: Parametros): FiltrosLancamentos {
  const hoje = hojeEmBrasilia();
  const ref = texto(p, "ref");
  return {
    periodo: umDe(texto(p, "periodo"), ["mes", "trimestre", "ano"] as const, "mes"),
    ref: ref && /^\d{4}-\d{2}-\d{2}$/.test(ref) ? ref : montarData(Number(hoje.slice(0, 4)), Number(hoje.slice(5, 7)), 1),
    tipo: umDe(texto(p, "tipo"), ["todos", "entrada", "saida"] as const, "todos"),
    status: umDe(texto(p, "status"), ["todos", "pago", "pendente", "atrasado"] as const, "todos"),
    categoria: umDe(
      texto(p, "categoria"),
      ["todas", "servidor", "ferramentas", "impostos", "salarios", "marketing"] as const,
      "todas",
    ),
    cliente: /^[0-9a-f-]{36}$/.test(texto(p, "cliente") ?? "") ? texto(p, "cliente")! : "",
  };
}

/** Filtros como parâmetros de URL (para links e exportação). */
export function filtrosParaUrl(f: FiltrosLancamentos): Record<string, string> {
  return Object.fromEntries(Object.entries(f).filter(([, v]) => v !== "")) as Record<string, string>;
}

/** Lançamentos ativos (não excluídos) do período, pela data de vencimento. */
export async function buscarLancamentos(
  supabase: Awaited<ReturnType<typeof criarClienteSupabase>>,
  f: FiltrosLancamentos,
): Promise<{ linhas: LinhaLancamento[]; erro: boolean }> {
  const { inicio, fim } = intervaloDoPeriodo(f.periodo, f.ref);
  let consulta = supabase
    .from("v_lancamentos")
    .select(
      "id, tipo, descricao, valor_centavos, forma_pagamento, vencimento, data_pagamento, status_efetivo, dias_atraso, categoria, cliente_id, mensalidade_id, gasto_recorrente_id",
    )
    .gte("vencimento", inicio)
    .lte("vencimento", fim)
    .order("vencimento")
    .order("descricao");
  if (f.tipo !== "todos") consulta = consulta.eq("tipo", f.tipo);
  if (f.status !== "todos") consulta = consulta.eq("status_efetivo", f.status);
  if (f.categoria !== "todas") consulta = consulta.eq("categoria", f.categoria);
  if (f.cliente) consulta = consulta.eq("cliente_id", f.cliente);

  const [{ data, error }, { data: clientes }] = await Promise.all([
    consulta,
    supabase.from("clientes").select("id, nome"),
  ]);
  const nomes = new Map((clientes ?? []).map((c) => [c.id as string, c.nome as string]));
  const linhas = (data ?? []).map((l) => ({
    ...(l as Omit<LinhaLancamento, "cliente_nome">),
    cliente_nome: l.cliente_id ? (nomes.get(l.cliente_id) ?? null) : null,
  }));
  return { linhas, erro: Boolean(error) };
}
