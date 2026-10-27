import type { Metadata } from "next";
import Link from "next/link";
import { Cartao, Mensagem, TituloPagina } from "@/components/ui";
import { reajustesAguardando } from "@/lib/consultas/mensalidades";
import { formatarData } from "@/lib/dominio/datas";
import { formatarReais } from "@/lib/dominio/dinheiro";
import { criarClienteSupabase } from "@/lib/supabase/servidor";
import { aplicarReajusteManual } from "../acoes";
import { IndiceManual } from "./IndiceManual";

export const metadata: Metadata = { title: "Reajustes IPCA — Mov Code" };

const mesAno = (mes: string) => `${mes.slice(5, 7)}/${mes.slice(0, 4)}`;

export default async function PaginaReajustes({ searchParams }: PageProps<"/financeiro/reajustes">) {
  const { aviso } = await searchParams;
  const supabase = await criarClienteSupabase();
  const [pendentes, { data: ultimoIpca }, { data: aplicados }, { data: mensalidades }, { data: clientes }] =
    await Promise.all([
      reajustesAguardando(supabase),
      supabase.from("ipca_mensal").select("competencia, variacao_percentual").order("competencia", { ascending: false }).limit(1),
      supabase
        .from("reajustes")
        .select("id, mensalidade_id, aplicado_em, indice_percentual, indice_aplicado, fonte, valor_anterior_centavos, valor_novo_centavos")
        .order("aplicado_em", { ascending: false })
        .limit(30),
      supabase.from("mensalidades").select("id, cliente_id"),
      supabase.from("clientes").select("id, nome"),
    ]);
  const clienteDaMensalidade = new Map((mensalidades ?? []).map((m) => [m.id, m.cliente_id]));
  const nomeCliente = new Map((clientes ?? []).map((c) => [c.id, c.nome]));

  return (
    <>
      <TituloPagina descricao="Reajuste anual automático pelo IPCA (Banco Central, série 433), a partir da 13ª cobrança.">
        Reajustes IPCA
      </TituloPagina>
      {aviso === "aplicado" && (
        <div className="mb-4">
          <Mensagem tipo="sucesso">Reajuste aplicado. A próxima cobrança já sai com o valor novo.</Mensagem>
        </div>
      )}
      <p className="mb-6 text-sm text-texto-secundario">
        Último IPCA recebido:{" "}
        {ultimoIpca?.[0]
          ? `${mesAno(String(ultimoIpca[0].competencia))} (${Number(ultimoIpca[0].variacao_percentual).toLocaleString("pt-BR")}%)`
          : "nenhum ainda — a rotina diária busca no Banco Central."}
      </p>

      <h2 className="mb-3 text-lg font-semibold">Aguardando índice</h2>
      {pendentes.length === 0 ? (
        <p className="mb-8 text-sm text-texto-secundario">Nenhum reajuste pendente.</p>
      ) : (
        <div className="mb-8 flex flex-col gap-3">
          <Mensagem tipo="info">
            Estes reajustes já deveriam valer, mas o IPCA do Banco Central ainda não está disponível. O sistema tenta de
            novo todo dia. Se preferir, informe o IPCA acumulado do período (ex.: na calculadora do cidadão do Banco
            Central). As cobranças seguem com o valor atual até o reajuste ser aplicado.
          </Mensagem>
          {pendentes.map((p) => (
            <Cartao key={`${p.mensalidadeId}-${p.aniversario}`} className="flex flex-col gap-3">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <Link href={`/clientes/${p.clienteId}`} className="font-medium hover:text-destaque">
                  {p.cliente} — {p.produto}
                </Link>
                <span className="tabular-nums">{formatarReais(p.valorAtual)}/mês</span>
              </div>
              <p className="text-sm text-texto-secundario">
                {p.aniversario}º reajuste, previsto para {formatarData(p.vencimento)}. IPCA de {mesAno(p.janela.inicio)} a{" "}
                {mesAno(p.janela.fim)}
                {p.mesesFaltando.length > 0 && ` — faltam: ${p.mesesFaltando.map(mesAno).join(", ")}`}.
              </p>
              <IndiceManual acao={aplicarReajusteManual.bind(null, p.mensalidadeId, p.aniversario)} />
            </Cartao>
          ))}
        </div>
      )}

      <h2 className="mb-3 text-lg font-semibold">Últimos reajustes aplicados</h2>
      <ul className="divide-y divide-borda overflow-hidden rounded-2xl border border-borda text-sm">
        {aplicados?.map((r) => {
          const clienteId = clienteDaMensalidade.get(r.mensalidade_id);
          return (
            <li key={r.id} className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <span>
                {formatarData(r.aplicado_em)} ·{" "}
                <Link href={`/clientes/${clienteId}`} className="hover:text-destaque">
                  {nomeCliente.get(clienteId) ?? "Cliente"}
                </Link>
              </span>
              <span className="tabular-nums text-texto-secundario">
                {formatarReais(r.valor_anterior_centavos)} → {formatarReais(r.valor_novo_centavos)} · IPCA{" "}
                {Number(r.indice_percentual).toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%
                {Number(r.indice_aplicado) === 0 && Number(r.indice_percentual) < 0 && " (negativo: valor mantido)"}
                {r.fonte === "manual" && " · manual"}
              </span>
            </li>
          );
        })}
        {aplicados?.length === 0 && <li className="px-4 py-6 text-center text-texto-secundario">Nenhum reajuste ainda.</li>}
      </ul>
    </>
  );
}
