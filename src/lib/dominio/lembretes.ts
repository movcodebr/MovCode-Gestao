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
