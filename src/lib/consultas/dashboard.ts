import "server-only";
import {
  calcularIndicadores,
  type CobrancaAtrasada,
  mesesDoGrafico,
  type Pago,
  preverRecorrencia,
  resumirInadimplencia,
  serieMensal,
} from "@/lib/dominio/dashboard";
import { type DataISO, hojeEmBrasilia, intervaloDoPeriodo, somarDias, type TipoPeriodo } from "@/lib/dominio/datas";
import { contatoPessoal } from "@/lib/dominio/lembretes";
import { calcularMrr } from "@/lib/dominio/mensalidades";
import type { criarClienteSupabase } from "@/lib/supabase/servidor";
import { reajustesAguardando } from "./mensalidades";

type Supabase = Awaited<ReturnType<typeof criarClienteSupabase>>;

export type ItemAgenda = {
  id: string | null;
  descricao: string;
  vencimento: DataISO;
  valor: number;
  previsto: boolean;
};

export type ContatoPessoal = {
  lancamentoId: string;
  clienteId: string;
  cliente: string;
  telefone: string;
  email: string;
  produto: string;
  valor: number;
  diasAtraso: number;
};

function somar(itens: { valor: number }[]): number {
  return itens.reduce((s, i) => s + i.valor, 0);
}

/** Tudo que o dashboard precisa para o período escolhido. */
export async function carregarDashboard(supabase: Supabase, tipo: TipoPeriodo, referencia: DataISO) {
  const hoje = hojeEmBrasilia();
  const daqui30 = somarDias(hoje, 30);
  const { inicio, fim } = intervaloDoPeriodo(tipo, referencia);

  const [pagosRes, abertosRes, mensalidadesRes, clientesRes, produtosRes, gastosRes, recorrentesGeradosRes, pendentesReajuste] =
    await Promise.all([
      supabase.from("v_lancamentos").select("tipo, valor_centavos, data_pagamento").eq("status", "pago"),
      supabase
        .from("v_lancamentos")
        .select("id, tipo, descricao, valor_centavos, vencimento, dias_atraso, cliente_id, mensalidade_id")
        .eq("status", "pendente")
        .lte("vencimento", daqui30),
      supabase
        .from("mensalidades")
        .select("id, cliente_id, produto_id, valor_atual_centavos, dia_vencimento, data_inicio, status, criado_em"),
      supabase.from("clientes").select("id, nome, telefone, email, ativo, reativado_em"),
      supabase.from("produtos").select("id, nome"),
      supabase.from("gastos_recorrentes").select("*").is("encerrado_em", null),
      supabase.from("lancamentos").select("mensalidade_id, gasto_recorrente_id, competencia").not("competencia", "is", null),
      reajustesAguardando(supabase),
    ]);

  const pagos: Pago[] = (pagosRes.data ?? []).map((l) => ({
    tipo: l.tipo,
    valor: l.valor_centavos,
    dataPagamento: l.data_pagamento,
  }));
  const clientes = new Map((clientesRes.data ?? []).map((c) => [c.id, c]));
  const produtos = new Map((produtosRes.data ?? []).map((p) => [p.id, p.nome]));
  const mensalidades = mensalidadesRes.data ?? [];
  const mensalidadePorId = new Map(mensalidades.map((m) => [m.id, m]));

  // Competências já geradas, por mensalidade e por gasto recorrente
  const geradas = new Map<string, Set<string>>();
  for (const l of recorrentesGeradosRes.data ?? []) {
    const chave = l.mensalidade_id ?? l.gasto_recorrente_id;
    if (!geradas.has(chave)) geradas.set(chave, new Set());
    geradas.get(chave)!.add(String(l.competencia).slice(0, 7));
  }

  // Indicadores e gráfico (caixa)
  const indicadores = calcularIndicadores(pagos, inicio, fim);
  const grafico = serieMensal(pagos, mesesDoGrafico(tipo, inicio, fim));
  const mrr = calcularMrr(
    mensalidades.map((m) => ({
      valorAtual: m.valor_atual_centavos,
      status: m.status,
      clienteAtivo: Boolean(clientes.get(m.cliente_id)?.ativo),
    })),
  );

  // A receber e a pagar nos próximos 30 dias: lançamentos existentes + previsão
  const abertos = abertosRes.data ?? [];
  const aReceber: ItemAgenda[] = [];
  const aPagar: ItemAgenda[] = [];
  for (const l of abertos) {
    if (l.vencimento < hoje) continue;
    const item = { id: l.id, descricao: l.descricao, vencimento: l.vencimento, valor: l.valor_centavos, previsto: false };
    (l.tipo === "entrada" ? aReceber : aPagar).push(item);
  }
  for (const m of mensalidades) {
    const cliente = clientes.get(m.cliente_id);
    if (m.status !== "ativa" || !cliente?.ativo) continue;
    const cadastro = hojeEmBrasilia(new Date(m.criado_em));
    const piso = [m.data_inicio, cadastro, cliente.reativado_em ?? ""].sort().at(-1)!;
    for (const p of preverRecorrencia(
      { dataInicio: m.data_inicio, dia: m.dia_vencimento, piso, valor: m.valor_atual_centavos },
      geradas.get(m.id) ?? new Set(),
      hoje,
      daqui30,
    )) {
      aReceber.push({ id: null, descricao: `${cliente.nome} — ${produtos.get(m.produto_id) ?? "mensalidade"}`, ...p, previsto: true });
    }
  }
  for (const g of gastosRes.data ?? []) {
    const cadastro = hojeEmBrasilia(new Date(g.criado_em));
    for (const p of preverRecorrencia(
      { dataInicio: g.data_inicio, dia: g.dia_vencimento, piso: g.data_inicio > cadastro ? g.data_inicio : cadastro, dataFim: g.data_fim, valor: g.valor_centavos },
      geradas.get(g.id) ?? new Set(),
      hoje,
      daqui30,
    )) {
      aPagar.push({ id: null, descricao: g.descricao, ...p, previsto: true });
    }
  }
  const porData = (a: ItemAgenda, b: ItemAgenda) => a.vencimento.localeCompare(b.vencimento);
  aReceber.sort(porData);
  aPagar.sort(porData);

  // Inadimplência e Contato pessoal (cobranças de mensalidade atrasadas de clientes ativos)
  const atrasadas: CobrancaAtrasada[] = [];
  const contatos: ContatoPessoal[] = [];
  for (const l of abertos) {
    if (!l.mensalidade_id || l.dias_atraso <= 0) continue;
    const cliente = clientes.get(l.cliente_id);
    if (!cliente?.ativo) continue;
    atrasadas.push({ clienteId: cliente.id, cliente: cliente.nome, valor: l.valor_centavos, diasAtraso: l.dias_atraso });
    const mensalidade = mensalidadePorId.get(l.mensalidade_id);
    if (contatoPessoal(l.dias_atraso) && mensalidade?.status === "ativa") {
      contatos.push({
        lancamentoId: l.id,
        clienteId: cliente.id,
        cliente: cliente.nome,
        telefone: cliente.telefone,
        email: cliente.email,
        produto: produtos.get(mensalidade.produto_id) ?? "Mensalidade",
        valor: l.valor_centavos,
        diasAtraso: l.dias_atraso,
      });
    }
  }
  contatos.sort((a, b) => b.diasAtraso - a.diasAtraso);

  return {
    periodo: { inicio, fim },
    hoje,
    indicadores: { ...indicadores, mrr },
    grafico,
    aReceber: { itens: aReceber, total: somar(aReceber) },
    aPagar: { itens: aPagar, total: somar(aPagar) },
    inadimplencia: resumirInadimplencia(atrasadas),
    contatoPessoal: contatos,
    reajustesPendentes: pendentesReajuste.length,
    erro: [pagosRes, abertosRes, mensalidadesRes, clientesRes].some((r) => r.error),
  };
}
