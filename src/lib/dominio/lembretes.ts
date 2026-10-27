import type { Centavos } from "./dinheiro";
import { type DataISO, diasEntre } from "./datas";

/**
 * Calendário dos lembretes automáticos de cobrança.
 * - 1º lembrete no dia do vencimento; depois a cada 3 dias (vencimento + 3, + 6, ...).
 * - Último lembrete automático no 30º dia de atraso. Depois disso a cobrança vai para a
 *   lista "Contato pessoal" do dashboard.
 * - A contagem é sempre a partir do vencimento (pausas não deslocam o calendário).
 */
export const INTERVALO_LEMBRETES = 3;
export const LIMITE_DIAS_LEMBRETE = 30;

/** Hoje é dia de lembrete para uma cobrança com estes dias de atraso? */
export function diaDeLembrete(diasAtraso: number): boolean {
  return diasAtraso >= 0 && diasAtraso <= LIMITE_DIAS_LEMBRETE && diasAtraso % INTERVALO_LEMBRETES === 0;
}

/** Cobrança com mais de 30 dias de atraso: sai dos lembretes e vai para "Contato pessoal". */
export function contatoPessoal(diasAtraso: number): boolean {
  return diasAtraso > LIMITE_DIAS_LEMBRETE;
}


export type Canal = "email" | "whatsapp";

export type Pausa = { inicio: DataISO; fim: DataISO; retomadoEm: DataISO | null };

/**
 * A pausa vale de `inicio` até o dia anterior a `fim` (na data final os lembretes voltam
 * sozinhos), ou até ser retomada manualmente.
 */
export function pausaVigente(pausas: Pausa[], hoje: DataISO): Pausa | null {
  return pausas.find((p) => p.inicio <= hoje && hoje < (p.retomadoEm ?? p.fim) && hoje < p.fim) ?? null;
}

export type CobrancaParaLembrete = {
  lancamentoId: string;
  clienteId: string;
  produto: string;
  valor: Centavos;
  vencimento: DataISO;
  pago: boolean;
  /** Cobrança de mensalidade (vendas únicas não recebem lembrete) */
  mensalidadeAtiva: boolean;
};

export type ClienteParaLembrete = {
  id: string;
  nome: string;
  email: string;
  telefone: string;
  ativo: boolean;
  pausas: Pausa[];
};

export type ItemLembrete = {
  lancamentoId: string;
  produto: string;
  valor: Centavos;
  vencimento: DataISO;
  diasAtraso: number;
};

export type GrupoLembrete = { cliente: ClienteParaLembrete; itens: ItemLembrete[] };

/**
 * Quem recebe lembrete hoje, agrupado por cliente (um lembrete por canal listando todas as
 * cobranças do dia). Só cobranças não pagas, de mensalidades ativas, de clientes ativos e
 * sem pausa vigente, em dia de calendário (0, 3, 6, ..., 30 dias após o vencimento).
 * Lembretes que cairiam durante uma pausa não são enviados depois (o calendário é fixo).
 */
export function planejarLembretes(
  cobrancas: CobrancaParaLembrete[],
  clientes: Map<string, ClienteParaLembrete>,
  hoje: DataISO,
): GrupoLembrete[] {
  const grupos = new Map<string, GrupoLembrete>();
  for (const c of cobrancas) {
    if (c.pago || !c.mensalidadeAtiva) continue;
    const cliente = clientes.get(c.clienteId);
    if (!cliente?.ativo || pausaVigente(cliente.pausas, hoje)) continue;
    const diasAtraso = diasEntre(c.vencimento, hoje);
    if (!diaDeLembrete(diasAtraso)) continue;
    const grupo = grupos.get(cliente.id) ?? { cliente, itens: [] };
    grupo.itens.push({ lancamentoId: c.lancamentoId, produto: c.produto, valor: c.valor, vencimento: c.vencimento, diasAtraso });
    grupos.set(cliente.id, grupo);
  }
  for (const g of grupos.values()) g.itens.sort((a, b) => a.diasAtraso - b.diasAtraso || a.produto.localeCompare(b.produto));
  return [...grupos.values()];
}

/** Tira do grupo as cobranças que já têm lembrete registrado hoje neste canal. */
export function semJaEnviados(grupo: GrupoLembrete, jaEnviados: Set<string>, canal: Canal): GrupoLembrete {
  return { ...grupo, itens: grupo.itens.filter((i) => !jaEnviados.has(`${i.lancamentoId}|${canal}`)) };
}
