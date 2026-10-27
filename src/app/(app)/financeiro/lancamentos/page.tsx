import type { Metadata } from "next";
import Link from "next/link";
import { FiltroPeriodo } from "@/components/FiltroPeriodo";
import { StatusLancamento } from "@/components/StatusLancamento";
import { Botao, Mensagem, Selecao, TituloPagina } from "@/components/ui";
import { buscarLancamentos, filtrosParaUrl, lerFiltros } from "@/lib/consultas/lancamentos";
import { formatarData, hojeEmBrasilia } from "@/lib/dominio/datas";
import { formatarReais } from "@/lib/dominio/dinheiro";
import { CATEGORIAS_GASTO, FORMAS_PAGAMENTO } from "@/lib/dominio/lancamentos";
import { criarClienteSupabase } from "@/lib/supabase/servidor";
import { marcarComoPago } from "../acoes";
import { MarcarPago } from "./MarcarPago";

export const metadata: Metadata = { title: "Lançamentos — Mov Code" };

const AVISOS: Record<string, string> = {
  venda: "Venda lançada.",
  gasto: "Gasto lançado.",
  excluido: "Lançamento excluído. Ele continua registrado no histórico de auditoria.",
};

export default async function PaginaLancamentos({ searchParams }: PageProps<"/financeiro/lancamentos">) {
  const params = await searchParams;
  const filtros = lerFiltros(params);
  const supabase = await criarClienteSupabase();
  const [{ linhas, erro }, { data: clientes }] = await Promise.all([
    buscarLancamentos(supabase, filtros),
    supabase.from("clientes").select("id, nome").order("nome"),
  ]);
  const hoje = hojeEmBrasilia();
  const aviso = typeof params.aviso === "string" ? AVISOS[params.aviso] : undefined;
  const entradas = linhas.filter((l) => l.tipo === "entrada").reduce((s, l) => s + l.valor_centavos, 0);
  const saidas = linhas.filter((l) => l.tipo === "saida").reduce((s, l) => s + l.valor_centavos, 0);
  const { periodo, ref, ...outros } = filtrosParaUrl(filtros);

  return (
    <>
      <TituloPagina descricao="Entradas e saídas pela data de vencimento.">Lançamentos</TituloPagina>
      {aviso && (
        <div className="mb-4">
          <Mensagem tipo="sucesso">{aviso}</Mensagem>
        </div>
      )}

      <div className="mb-4">
        <FiltroPeriodo caminho="/financeiro/lancamentos" tipo={filtros.periodo} referencia={filtros.ref} parametros={outros} />
      </div>
      <form className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-[repeat(4,1fr)_auto] lg:items-end">
        <input type="hidden" name="periodo" value={periodo} />
        <input type="hidden" name="ref" value={ref} />
        <Selecao rotulo="Tipo" name="tipo" defaultValue={filtros.tipo}>
          <option value="todos">Entradas e saídas</option>
          <option value="entrada">Entradas</option>
          <option value="saida">Saídas</option>
        </Selecao>
        <Selecao rotulo="Status" name="status" defaultValue={filtros.status}>
          <option value="todos">Todos</option>
          <option value="pago">Pago</option>
          <option value="pendente">Pendente</option>
          <option value="atrasado">Atrasado</option>
        </Selecao>
        <Selecao rotulo="Categoria (saídas)" name="categoria" defaultValue={filtros.categoria}>
          <option value="todas">Todas</option>
          {Object.entries(CATEGORIAS_GASTO).map(([valor, rotulo]) => (
            <option key={valor} value={valor}>
              {rotulo}
            </option>
          ))}
        </Selecao>
        <Selecao rotulo="Cliente" name="cliente" defaultValue={filtros.cliente}>
          <option value="">Todos</option>
          {clientes?.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nome}
            </option>
          ))}
        </Selecao>
        <Botao type="submit" variante="secundario">
          Filtrar
        </Botao>
      </form>

      {erro && <Mensagem tipo="erro">Não foi possível carregar os lançamentos.</Mensagem>}

      <div className="mb-3 flex flex-wrap gap-x-6 gap-y-1 text-sm">
        <span>
          Entradas: <strong className="text-sucesso tabular-nums">{formatarReais(entradas)}</strong>
        </span>
        <span>
          Saídas: <strong className="text-perigo tabular-nums">{formatarReais(saidas)}</strong>
        </span>
        <span className="text-texto-secundario">{linhas.length} lançamento(s)</span>
      </div>

      <ul className="divide-y divide-borda overflow-hidden rounded-2xl border border-borda">
        {linhas.map((l) => (
          <li key={l.id} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <Link href={`/financeiro/lancamentos/${l.id}`} className="font-medium hover:text-destaque">
                {l.descricao}
              </Link>
              <p className="text-sm text-texto-secundario">
                {[
                  l.cliente_nome,
                  l.categoria && CATEGORIAS_GASTO[l.categoria],
                  `vence ${formatarData(l.vencimento)}`,
                  FORMAS_PAGAMENTO[l.forma_pagamento],
                  l.mensalidade_id && "mensalidade",
                  l.gasto_recorrente_id && "recorrente",
                  l.data_pagamento && `pago em ${formatarData(l.data_pagamento)}`,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3 sm:justify-end">
              <span className={`font-semibold tabular-nums ${l.tipo === "entrada" ? "text-sucesso" : "text-perigo"}`}>
                {l.tipo === "entrada" ? "+" : "−"} {formatarReais(l.valor_centavos)}
              </span>
              <StatusLancamento status={l.status_efetivo} />
              {l.status_efetivo !== "pago" && (
                <MarcarPago
                  descricao={`${l.descricao} — ${formatarReais(l.valor_centavos)}`}
                  formaAtual={l.forma_pagamento}
                  hoje={hoje}
                  acao={marcarComoPago.bind(null, l.id)}
                />
              )}
            </div>
          </li>
        ))}
        {linhas.length === 0 && (
          <li className="px-4 py-6 text-center text-texto-secundario">Nenhum lançamento neste período.</li>
        )}
      </ul>
    </>
  );
}
