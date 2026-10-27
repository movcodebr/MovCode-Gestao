import type { SupabaseClient } from "@supabase/supabase-js";
import { type DataISO, hojeEmBrasilia } from "@/lib/dominio/datas";
import {
  type Acao,
  competenciaDoMes,
  planejarGastoRecorrente,
  planejarMensalidade,
} from "@/lib/dominio/mensalidades";
import type { Mes } from "@/lib/dominio/reajuste";

type Linha = Record<string, unknown>;

/** Data (Brasília) em que o registro foi criado. */
function dataDeCadastro(criadoEm: string): DataISO {
  return hojeEmBrasilia(new Date(criadoEm));
}

function porChave<T extends Linha>(linhas: T[], chave: keyof T): Map<string, T> {
  return new Map(linhas.map((l) => [String(l[chave]), l]));
}

function agrupar(linhas: Linha[], chave: string, valor: (l: Linha) => string): Map<string, Set<string>> {
  const mapa = new Map<string, Set<string>>();
  for (const l of linhas) {
    const k = String(l[chave]);
    if (!mapa.has(k)) mapa.set(k, new Set());
    mapa.get(k)!.add(valor(l));
  }
  return mapa;
}

async function consultar(promessa: PromiseLike<{ data: unknown; error: { message: string } | null }>): Promise<Linha[]> {
  const { data, error } = await promessa;
  if (error) throw new Error(error.message);
  return (data ?? []) as Linha[];
}

function nomeMes(mes: Mes): string {
  const [ano, m] = mes.split("-");
  return `${m}/${ano}`;
}

export type ResultadoCobrancas = {
  cobrancasCriadas: number;
  reajustesAplicados: number;
  reajustesPendentes: { mensalidadeId: string; aniversario: number; mesesFaltando: string[] }[];
  erros: string[];
};

/**
 * Gera as cobranças do dia (e as atrasadas por falha da rotina) de todas as mensalidades
 * ativas de clientes ativos, aplicando antes os reajustes devidos. Pode rodar várias vezes
 * no mesmo dia sem duplicar nada (o banco recusa competência repetida).
 */
export async function gerarCobrancas(
  supabase: SupabaseClient,
  hoje: DataISO,
  ipca: Map<Mes, string>,
): Promise<ResultadoCobrancas> {
  const resultado: ResultadoCobrancas = { cobrancasCriadas: 0, reajustesAplicados: 0, reajustesPendentes: [], erros: [] };
  const mensalidades = await consultar(
    supabase
      .from("mensalidades")
      .select("id, cliente_id, produto_id, valor_atual_centavos, dia_vencimento, data_inicio, forma_pagamento, criado_em")
      .eq("status", "ativa"),
  );
  if (mensalidades.length === 0) return resultado;
  const ids = mensalidades.map((m) => String(m.id));
  const [clientes, produtos, existentes, reajustes] = await Promise.all([
    consultar(supabase.from("clientes").select("id, ativo, reativado_em")),
    consultar(supabase.from("produtos").select("id, nome")),
    consultar(supabase.from("lancamentos").select("mensalidade_id, competencia").in("mensalidade_id", ids)),
    consultar(supabase.from("reajustes").select("mensalidade_id, aniversario").in("mensalidade_id", ids)),
  ]);
  const clientePorId = porChave(clientes, "id");
  const produtoPorId = porChave(produtos, "id");
  const competencias = agrupar(existentes, "mensalidade_id", (l) => String(l.competencia).slice(0, 7));
  const aniversarios = agrupar(reajustes, "mensalidade_id", (l) => String(l.aniversario));

  for (const m of mensalidades) {
    const id = String(m.id);
    const cliente = clientePorId.get(String(m.cliente_id));
    const acoes: Acao[] = planejarMensalidade(
      {
        dataInicio: String(m.data_inicio),
        dia: Number(m.dia_vencimento),
        dataCadastro: dataDeCadastro(String(m.criado_em)),
        reativadoEm: (cliente?.reativado_em as string | null) ?? null,
        valorAtual: Number(m.valor_atual_centavos),
        ativa: Boolean(cliente?.ativo),
      },
      competencias.get(id) ?? new Set(),
      new Set([...(aniversarios.get(id) ?? [])].map(Number)),
      ipca,
      hoje,
    );

    for (const acao of acoes) {
      if (acao.tipo === "reajuste_pendente") {
        resultado.reajustesPendentes.push({ mensalidadeId: id, aniversario: acao.aniversario, mesesFaltando: acao.mesesFaltando });
        continue;
      }
      if (acao.tipo === "reajuste") {
        const { error } = await supabase.rpc("aplicar_reajuste", {
          p: {
            mensalidade_id: id,
            aniversario: acao.aniversario,
            vale_a_partir_de: competenciaDoMes(acao.valeAPartirDe),
            janela_inicio: competenciaDoMes(acao.janela.inicio),
            janela_fim: competenciaDoMes(acao.janela.fim),
            indice_percentual: acao.indicePercentual,
            indice_aplicado: acao.indiceAplicado,
            fonte: "bcb",
            valor_anterior: acao.valorAnterior,
            valor_novo: acao.valorNovo,
          },
        });
        if (error) {
          // Sem o reajuste confirmado, não gera cobranças desta mensalidade hoje (evita valor errado)
          resultado.erros.push(`Reajuste da mensalidade ${id}: ${error.message}`);
          break;
        }
        resultado.reajustesAplicados++;
        continue;
      }
      const produto = produtoPorId.get(String(m.produto_id));
      const { data, error } = await supabase
        .from("lancamentos")
        .upsert(
          {
            tipo: "entrada",
            descricao: `${produto?.nome ?? "Mensalidade"} — mensalidade ${nomeMes(acao.competencia)}`,
            valor_centavos: acao.valor,
            forma_pagamento: m.forma_pagamento,
            vencimento: acao.vencimento,
            cliente_id: m.cliente_id,
            mensalidade_id: id,
            competencia: competenciaDoMes(acao.competencia),
          },
          { onConflict: "mensalidade_id,competencia", ignoreDuplicates: true },
        )
        .select("id");
      if (error) resultado.erros.push(`Cobrança ${nomeMes(acao.competencia)} da mensalidade ${id}: ${error.message}`);
      else resultado.cobrancasCriadas += data?.length ?? 0;
    }
  }
  return resultado;
}

/** Lança os gastos recorrentes do dia (e os atrasados por falha da rotina), sem duplicar. */
export async function gerarGastosRecorrentes(
  supabase: SupabaseClient,
  hoje: DataISO,
): Promise<{ gastosCriados: number; erros: string[] }> {
  const resultado = { gastosCriados: 0, erros: [] as string[] };
  const gastos = await consultar(supabase.from("gastos_recorrentes").select("*").is("encerrado_em", null));
  if (gastos.length === 0) return resultado;
  const existentes = await consultar(
    supabase
      .from("lancamentos")
      .select("gasto_recorrente_id, competencia")
      .in("gasto_recorrente_id", gastos.map((g) => String(g.id))),
  );
  const competencias = agrupar(existentes, "gasto_recorrente_id", (l) => String(l.competencia).slice(0, 7));

  for (const g of gastos) {
    const lancar = planejarGastoRecorrente(
      {
        dataInicio: String(g.data_inicio),
        dia: Number(g.dia_vencimento),
        dataCadastro: dataDeCadastro(String(g.criado_em)),
        dataFim: (g.data_fim as string | null) ?? null,
        encerradoEm: (g.encerrado_em as string | null) ?? null,
        valor: Number(g.valor_centavos),
      },
      competencias.get(String(g.id)) ?? new Set(),
      hoje,
    );
    for (const item of lancar) {
      const { data, error } = await supabase
        .from("lancamentos")
        .upsert(
          {
            tipo: "saida",
            descricao: String(g.descricao),
            categoria: g.categoria,
            valor_centavos: item.valor,
            forma_pagamento: g.forma_pagamento,
            vencimento: item.vencimento,
            gasto_recorrente_id: g.id,
            competencia: competenciaDoMes(item.competencia),
          },
          { onConflict: "gasto_recorrente_id,competencia", ignoreDuplicates: true },
        )
        .select("id");
      if (error) resultado.erros.push(`Gasto ${g.descricao} ${nomeMes(item.competencia)}: ${error.message}`);
      else resultado.gastosCriados += data?.length ?? 0;
    }
  }
  return resultado;
}
