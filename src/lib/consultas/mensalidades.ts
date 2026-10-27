import "server-only";
import { hojeEmBrasilia } from "@/lib/dominio/datas";
import { janelaIpca, type Mes } from "@/lib/dominio/reajuste";
import { proximoReajuste, reajustePendente } from "@/lib/dominio/mensalidades";
import type { criarClienteSupabase } from "@/lib/supabase/servidor";

type Supabase = Awaited<ReturnType<typeof criarClienteSupabase>>;

export type MensalidadeDoCliente = {
  id: string;
  produto: string;
  valorAtual: number;
  dia: number;
  dataInicio: string;
  status: "ativa" | "cancelada";
  canceladaEm: string | null;
  proximoReajuste: string | null;
  emAtraso: boolean;
  reajustes: { aniversario: number; aplicadoEm: string; indice: string; fonte: string; anterior: number; novo: number }[];
};

/** Mensalidades de um cliente, com situação de pagamento, próximo reajuste e histórico de valores. */
export async function mensalidadesDoCliente(supabase: Supabase, clienteId: string): Promise<MensalidadeDoCliente[]> {
  const { data: mensalidades } = await supabase
    .from("mensalidades")
    .select("id, produto_id, valor_atual_centavos, dia_vencimento, data_inicio, status, cancelada_em, criado_em")
    .eq("cliente_id", clienteId)
    .order("status")
    .order("data_inicio");
  if (!mensalidades?.length) return [];
  const ids = mensalidades.map((m) => m.id);
  const [{ data: produtos }, { data: reajustes }, { data: atrasadas }] = await Promise.all([
    supabase.from("produtos").select("id, nome"),
    supabase
      .from("reajustes")
      .select("mensalidade_id, aniversario, aplicado_em, indice_aplicado, fonte, valor_anterior_centavos, valor_novo_centavos")
      .in("mensalidade_id", ids)
      .order("aniversario"),
    supabase.from("v_lancamentos").select("mensalidade_id").in("mensalidade_id", ids).eq("status_efetivo", "atrasado"),
  ]);
  const nomeProduto = new Map((produtos ?? []).map((p) => [p.id, p.nome]));
  const comAtraso = new Set((atrasadas ?? []).map((l) => l.mensalidade_id));

  return mensalidades.map((m) => {
    const historico = (reajustes ?? []).filter((r) => r.mensalidade_id === m.id);
    const proximo =
      m.status === "ativa"
        ? proximoReajuste(
            { dataInicio: m.data_inicio, dia: m.dia_vencimento, dataCadastro: hojeEmBrasilia(new Date(m.criado_em)) },
            new Set(historico.map((r) => r.aniversario)),
          ).vencimento
        : null;
    return {
      id: m.id,
      produto: nomeProduto.get(m.produto_id) ?? "Produto",
      valorAtual: m.valor_atual_centavos,
      dia: m.dia_vencimento,
      dataInicio: m.data_inicio,
      status: m.status,
      canceladaEm: m.cancelada_em,
      proximoReajuste: proximo,
      emAtraso: comAtraso.has(m.id),
      reajustes: historico.map((r) => ({
        aniversario: r.aniversario,
        aplicadoEm: r.aplicado_em,
        indice: r.indice_aplicado,
        fonte: r.fonte,
        anterior: r.valor_anterior_centavos,
        novo: r.valor_novo_centavos,
      })),
    };
  });
}

export type ReajusteAguardando = {
  mensalidadeId: string;
  cliente: string;
  clienteId: string;
  produto: string;
  valorAtual: number;
  aniversario: number;
  vencimento: string;
  janela: { inicio: Mes; fim: Mes };
  mesesFaltando: Mes[];
};

/** Reajustes cuja data já chegou e ainda não foram aplicados (normalmente por falta do IPCA). */
export async function reajustesAguardando(supabase: Supabase): Promise<ReajusteAguardando[]> {
  const hoje = hojeEmBrasilia();
  const { data: mensalidades } = await supabase
    .from("mensalidades")
    .select("id, cliente_id, produto_id, valor_atual_centavos, dia_vencimento, data_inicio, criado_em")
    .eq("status", "ativa");
  if (!mensalidades?.length) return [];
  const [{ data: clientes }, { data: produtos }, { data: reajustes }, { data: ipca }] = await Promise.all([
    supabase.from("clientes").select("id, nome, ativo"),
    supabase.from("produtos").select("id, nome"),
    supabase.from("reajustes").select("mensalidade_id, aniversario"),
    supabase.from("ipca_mensal").select("competencia"),
  ]);
  const cliente = new Map((clientes ?? []).map((c) => [c.id, c]));
  const produto = new Map((produtos ?? []).map((p) => [p.id, p.nome]));
  const mesesComIpca = new Set((ipca ?? []).map((i) => String(i.competencia).slice(0, 7)));

  const lista: ReajusteAguardando[] = [];
  for (const m of mensalidades) {
    const c = cliente.get(m.cliente_id);
    if (!c?.ativo) continue;
    const aplicados = new Set((reajustes ?? []).filter((r) => r.mensalidade_id === m.id).map((r) => r.aniversario));
    const pendente = reajustePendente(
      { dataInicio: m.data_inicio, dia: m.dia_vencimento, dataCadastro: hojeEmBrasilia(new Date(m.criado_em)) },
      aplicados,
      hoje,
    );
    if (!pendente) continue;
    const janela = janelaIpca(pendente.mesAniversario);
    lista.push({
      mensalidadeId: m.id,
      cliente: c.nome,
      clienteId: c.id,
      produto: produto.get(m.produto_id) ?? "Produto",
      valorAtual: m.valor_atual_centavos,
      aniversario: pendente.aniversario,
      vencimento: pendente.vencimento,
      janela: { inicio: janela[0], fim: janela[11] },
      mesesFaltando: janela.filter((mes) => !mesesComIpca.has(mes)),
    });
  }
  return lista;
}
