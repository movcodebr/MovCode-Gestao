import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { FiltroPeriodo } from "@/components/FiltroPeriodo";
import { Cartao, Mensagem, TituloPagina } from "@/components/ui";
import { carregarDashboard, type ItemAgenda } from "@/lib/consultas/dashboard";
import { lerFiltros } from "@/lib/consultas/lancamentos";
import { formatarData } from "@/lib/dominio/datas";
import { formatarReais } from "@/lib/dominio/dinheiro";
import { formatarTelefone } from "@/lib/dominio/documento";
import { criarClienteSupabase } from "@/lib/supabase/servidor";
import { GraficoEntradasSaidas } from "./GraficoEntradasSaidas";

export const metadata: Metadata = { title: "Financeiro — Mov Code" };

function Indicador({ rotulo, valor, ajuda, destaque }: { rotulo: string; valor: number; ajuda: string; destaque?: boolean }) {
  return (
    <Cartao className="flex h-full flex-col gap-1 p-4 sm:p-5">
      <span className="text-sm text-texto-secundario">{rotulo}</span>
      <span className={`whitespace-nowrap text-lg font-semibold tabular-nums sm:text-xl xl:text-2xl ${destaque ? "text-destaque" : ""} ${valor < 0 ? "text-perigo" : ""}`}>
        {formatarReais(valor)}
      </span>
      <span className="text-xs text-texto-secundario">{ajuda}</span>
    </Cartao>
  );
}

function Secao({ titulo, children, extra }: { titulo: string; children: ReactNode; extra?: ReactNode }) {
  return (
    <Cartao className="flex flex-col gap-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-semibold">{titulo}</h2>
        {extra}
      </div>
      {children}
    </Cartao>
  );
}

function Agenda({ itens, vazio }: { itens: ItemAgenda[]; vazio: string }) {
  if (itens.length === 0) return <p className="text-sm text-texto-secundario">{vazio}</p>;
  return (
    <ul className="flex max-h-72 flex-col divide-y divide-borda overflow-y-auto text-sm">
      {itens.map((i, n) => (
        <li key={i.id ?? `previsto-${n}`} className="flex items-center justify-between gap-3 py-2">
          <span className="min-w-0">
            {i.id ? (
              <Link href={`/financeiro/lancamentos/${i.id}`} className="hover:text-destaque">
                {i.descricao}
              </Link>
            ) : (
              i.descricao
            )}
            <span className="block text-xs text-texto-secundario">
              {formatarData(i.vencimento)}
              {i.previsto && " · previsto"}
            </span>
          </span>
          <span className="shrink-0 tabular-nums">{formatarReais(i.valor)}</span>
        </li>
      ))}
    </ul>
  );
}

export default async function PaginaDashboard({ searchParams }: PageProps<"/financeiro">) {
  const filtros = lerFiltros(await searchParams);
  const supabase = await criarClienteSupabase();
  const d = await carregarDashboard(supabase, filtros.periodo, filtros.ref);
  const { periodo, ref } = filtros;

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <TituloPagina>Financeiro</TituloPagina>
        <div className="mb-6">
          <FiltroPeriodo caminho="/financeiro" tipo={periodo} referencia={ref} />
        </div>
      </div>
      {d.erro && (
        <div className="mb-4">
          <Mensagem tipo="erro">Alguns dados não puderam ser carregados. Atualize a página.</Mensagem>
        </div>
      )}
      {d.reajustesPendentes > 0 && (
        <div className="mb-4">
          <Mensagem tipo="info">
            {d.reajustesPendentes} reajuste(s) IPCA aguardando índice.{" "}
            <Link href="/financeiro/reajustes" className="underline hover:text-destaque">
              Ver reajustes
            </Link>
          </Mensagem>
        </div>
      )}

      <section className="mb-6 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-5">
        <div className="col-span-2 lg:col-span-1">
          <Indicador rotulo="Saldo" valor={d.indicadores.saldo} ajuda={`Acumulado em caixa até ${formatarData(d.periodo.fim)}`} />
        </div>
        <Indicador rotulo="Lucro do período" valor={d.indicadores.lucro} ajuda="Entradas pagas − saídas pagas" />
        <Indicador rotulo="MRR" valor={d.indicadores.mrr} ajuda="Mensalidades ativas de clientes ativos" destaque />
        <Indicador rotulo="Entradas pagas" valor={d.indicadores.entradas} ajuda="No período" />
        <Indicador rotulo="Saídas pagas" valor={d.indicadores.saidas} ajuda="No período" />
      </section>

      <Cartao className="mb-6">
        <GraficoEntradasSaidas dados={d.grafico} />
      </Cartao>

      <div className="mb-6 grid gap-4 lg:grid-cols-2">
        <Secao titulo="A receber — próximos 30 dias" extra={<span className="tabular-nums text-sucesso">{formatarReais(d.aReceber.total)}</span>}>
          <Agenda itens={d.aReceber.itens} vazio="Nada a receber nos próximos 30 dias." />
        </Secao>
        <Secao titulo="A pagar — próximos 30 dias" extra={<span className="tabular-nums text-perigo">{formatarReais(d.aPagar.total)}</span>}>
          <Agenda itens={d.aPagar.itens} vazio="Nada a pagar nos próximos 30 dias." />
        </Secao>
      </div>

      <div className="mb-6 grid gap-4 lg:grid-cols-2">
        <Secao
          titulo="Inadimplência"
          extra={<span className="tabular-nums text-perigo">{formatarReais(d.inadimplencia.total)}</span>}
        >
          {d.inadimplencia.clientes.length === 0 ? (
            <p className="text-sm text-texto-secundario">Nenhum cliente ativo com mensalidade em atraso.</p>
          ) : (
            <ul className="flex flex-col divide-y divide-borda text-sm">
              {d.inadimplencia.clientes.map((c) => (
                <li key={c.clienteId} className="flex items-center justify-between gap-3 py-2">
                  <Link href={`/clientes/${c.clienteId}`} className="hover:text-destaque">
                    {c.cliente}
                    <span className="block text-xs text-texto-secundario">
                      {c.cobrancas} cobrança(s) · até {c.maiorAtraso} dia(s) de atraso
                    </span>
                  </Link>
                  <span className="tabular-nums">{formatarReais(c.valor)}</span>
                </li>
              ))}
            </ul>
          )}
        </Secao>
        <Secao titulo="Contato pessoal" extra={<span className="text-xs text-texto-secundario">mais de 30 dias de atraso</span>}>
          {d.contatoPessoal.length === 0 ? (
            <p className="text-sm text-texto-secundario">Nenhuma cobrança com mais de 30 dias de atraso.</p>
          ) : (
            <ul className="flex flex-col divide-y divide-borda text-sm">
              {d.contatoPessoal.map((c) => (
                <li key={c.lancamentoId} className="flex flex-col gap-1 py-2">
                  <div className="flex items-center justify-between gap-3">
                    <Link href={`/clientes/${c.clienteId}`} className="font-medium hover:text-destaque">
                      {c.cliente}
                    </Link>
                    <span className="tabular-nums">{formatarReais(c.valor)}</span>
                  </div>
                  <span className="text-xs text-texto-secundario">
                    {c.produto} · <span className="text-perigo">{c.diasAtraso} dias de atraso</span>
                  </span>
                  <span className="text-xs">
                    <a href={`tel:+55${c.telefone}`} className="hover:text-destaque">
                      {formatarTelefone(c.telefone)}
                    </a>{" "}
                    ·{" "}
                    <a href={`mailto:${c.email}`} className="break-all hover:text-destaque">
                      {c.email}
                    </a>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Secao>
      </div>
    </>
  );
}
