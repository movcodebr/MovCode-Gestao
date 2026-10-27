import type { Metadata } from "next";
import Link from "next/link";
import { Etiqueta, LinkBotao, Mensagem, TituloPagina } from "@/components/ui";
import { formatarData, hojeEmBrasilia } from "@/lib/dominio/datas";
import { formatarReais } from "@/lib/dominio/dinheiro";
import { CATEGORIAS_GASTO, type CategoriaGasto } from "@/lib/dominio/lancamentos";
import { criarClienteSupabase } from "@/lib/supabase/servidor";

export const metadata: Metadata = { title: "Gastos recorrentes — Mov Code" };

const AVISOS: Record<string, string> = {
  criado: "Gasto recorrente criado. Ele é lançado automaticamente todo mês, no dia do vencimento.",
  salvo: "Alterações salvas. O novo valor vale para os próximos meses.",
  encerrado: "Recorrência encerrada. Os gastos já lançados continuam no histórico.",
};

export default async function PaginaGastosRecorrentes({ searchParams }: PageProps<"/financeiro/gastos/recorrentes">) {
  const { aviso } = await searchParams;
  const supabase = await criarClienteSupabase();
  const { data: gastos } = await supabase
    .from("gastos_recorrentes")
    .select("id, descricao, categoria, valor_centavos, dia_vencimento, data_inicio, data_fim, encerrado_em")
    .order("encerrado_em", { nullsFirst: true })
    .order("descricao");
  const hoje = hojeEmBrasilia();
  const ativo = (g: { encerrado_em: string | null; data_fim: string | null }) =>
    !g.encerrado_em && (!g.data_fim || g.data_fim >= hoje);

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <TituloPagina descricao="Gerados automaticamente todo mês, sem novo lançamento.">Gastos recorrentes</TituloPagina>
        <LinkBotao href="/financeiro/gastos/novo">Novo gasto</LinkBotao>
      </div>
      {typeof aviso === "string" && AVISOS[aviso] && (
        <div className="mb-4">
          <Mensagem tipo="sucesso">{AVISOS[aviso]}</Mensagem>
        </div>
      )}
      <ul className="divide-y divide-borda overflow-hidden rounded-2xl border border-borda">
        {gastos?.map((g) => (
          <li key={g.id}>
            <Link
              href={`/financeiro/gastos/recorrentes/${g.id}`}
              className="flex flex-col gap-1 px-4 py-3 hover:bg-superficie sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <p className="font-medium">{g.descricao}</p>
                <p className="text-sm text-texto-secundario">
                  {CATEGORIAS_GASTO[g.categoria as CategoriaGasto]} · todo dia {g.dia_vencimento} · desde{" "}
                  {formatarData(g.data_inicio)}
                  {g.data_fim && ` · até ${formatarData(g.data_fim)}`}
                  {g.encerrado_em && ` · encerrado em ${formatarData(g.encerrado_em)}`}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span className="font-semibold tabular-nums">{formatarReais(g.valor_centavos)}</span>
                {ativo(g) ? <Etiqueta cor="verde">Ativo</Etiqueta> : <Etiqueta cor="cinza">Encerrado</Etiqueta>}
              </div>
            </Link>
          </li>
        ))}
        {gastos?.length === 0 && (
          <li className="px-4 py-6 text-center text-texto-secundario">Nenhum gasto recorrente cadastrado.</li>
        )}
      </ul>
    </>
  );
}
