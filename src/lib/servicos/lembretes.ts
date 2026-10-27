import type { SupabaseClient } from "@supabase/supabase-js";
import { type DataISO, somarDias } from "@/lib/dominio/datas";
import {
  type ClienteParaLembrete,
  type CobrancaParaLembrete,
  LIMITE_DIAS_LEMBRETE,
  planejarLembretes,
} from "@/lib/dominio/lembretes";
import type { CanalEnvio } from "@/lib/lembretes/canais";
import { enviarLembretes, type RegistroLembretes, type ResumoEnvio } from "@/lib/lembretes/envio";
import type { DadosPagamento } from "@/lib/lembretes/mensagens";

async function linhas<T = Record<string, unknown>>(
  promessa: PromiseLike<{ data: unknown; error: { message: string } | null }>,
): Promise<T[]> {
  const { data, error } = await promessa;
  if (error) throw new Error(error.message);
  return (data ?? []) as T[];
}

/** Registro dos envios na tabela lembretes_enviados (com reserva para não duplicar). */
export function registroSupabase(supabase: SupabaseClient): RegistroLembretes {
  return {
    async reservar(clienteId, itens, canal, hoje, modo) {
      const { data, error } = await supabase
        .from("lembretes_enviados")
        .upsert(
          itens.map((i) => ({
            lancamento_id: i.lancamentoId,
            cliente_id: clienteId,
            data_referencia: hoje,
            dias_atraso: i.diasAtraso,
            canal,
            sucesso: false,
            erro: "enviando",
            modo,
          })),
          { onConflict: "lancamento_id,canal,data_referencia", ignoreDuplicates: true },
        )
        .select("lancamento_id");
      if (error) throw new Error(error.message);
      return (data ?? []).map((l) => String(l.lancamento_id));
    },
    async concluir(lancamentoIds, canal, hoje, ok, erro) {
      const { error } = await supabase
        .from("lembretes_enviados")
        .update({ sucesso: ok, erro: ok ? null : (erro ?? "falha sem detalhe").slice(0, 500) })
        .in("lancamento_id", lancamentoIds)
        .eq("canal", canal)
        .eq("data_referencia", hoje);
      if (error) throw new Error(error.message);
    },
  };
}

/** Envia os lembretes do dia (rotina diária). */
export async function executarLembretes(
  supabase: SupabaseClient,
  hoje: DataISO,
  canais: CanalEnvio[],
  pagamento: DadosPagamento,
): Promise<ResumoEnvio> {
  const [cobrancas, mensalidades, clientes, produtos, pausas, enviados] = await Promise.all([
    linhas(
      supabase
        .from("lancamentos")
        .select("id, cliente_id, mensalidade_id, valor_centavos, vencimento, status")
        .not("mensalidade_id", "is", null)
        .is("excluido_em", null)
        .eq("status", "pendente")
        .gte("vencimento", somarDias(hoje, -LIMITE_DIAS_LEMBRETE))
        .lte("vencimento", hoje),
    ),
    linhas(supabase.from("mensalidades").select("id, produto_id, status")),
    linhas(supabase.from("clientes").select("id, nome, email, telefone, ativo")),
    linhas(supabase.from("produtos").select("id, nome")),
    linhas(supabase.from("pausas_lembrete").select("cliente_id, inicio, fim, retomado_em")),
    linhas(supabase.from("lembretes_enviados").select("lancamento_id, canal").eq("data_referencia", hoje)),
  ]);

  const mensalidadePorId = new Map(mensalidades.map((m) => [String(m.id), m]));
  const nomeProduto = new Map(produtos.map((p) => [String(p.id), String(p.nome)]));
  const mapaClientes = new Map<string, ClienteParaLembrete>(
    clientes.map((c) => [
      String(c.id),
      {
        id: String(c.id),
        nome: String(c.nome),
        email: String(c.email),
        telefone: String(c.telefone),
        ativo: Boolean(c.ativo),
        pausas: pausas
          .filter((p) => p.cliente_id === c.id)
          .map((p) => ({ inicio: String(p.inicio), fim: String(p.fim), retomadoEm: (p.retomado_em as string | null) ?? null })),
      },
    ]),
  );
  const paraLembrete: CobrancaParaLembrete[] = cobrancas.map((l) => {
    const m = mensalidadePorId.get(String(l.mensalidade_id));
    return {
      lancamentoId: String(l.id),
      clienteId: String(l.cliente_id),
      produto: nomeProduto.get(String(m?.produto_id)) ?? "Mensalidade",
      valor: Number(l.valor_centavos),
      vencimento: String(l.vencimento),
      pago: l.status === "pago",
      mensalidadeAtiva: m?.status === "ativa",
    };
  });

  const grupos = planejarLembretes(paraLembrete, mapaClientes, hoje);
  const jaEnviados = new Set(enviados.map((e) => `${e.lancamento_id}|${e.canal}`));
  return enviarLembretes(grupos, canais, jaEnviados, pagamento, hoje, registroSupabase(supabase));
}
