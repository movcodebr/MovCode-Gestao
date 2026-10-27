import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ConfirmarAcao } from "@/components/ConfirmarAcao";
import { StatusLancamento } from "@/components/StatusLancamento";
import { Cartao, Mensagem, TituloPagina } from "@/components/ui";
import { formatarData, hojeEmBrasilia } from "@/lib/dominio/datas";
import { formatarReais, formatarValorCampo } from "@/lib/dominio/dinheiro";
import { criarClienteSupabase } from "@/lib/supabase/servidor";
import { excluirLancamento, salvarLancamento } from "../../acoes";
import { FormularioLancamento } from "./FormularioLancamento";

export const metadata: Metadata = { title: "Lançamento — Mov Code" };

const ACOES = { criou: "Criado", editou: "Editado", excluiu: "Excluído" } as const;

const formatoHora = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "short",
  timeStyle: "short",
  timeZone: "America/Sao_Paulo",
});

export default async function PaginaLancamento({ params, searchParams }: PageProps<"/financeiro/lancamentos/[id]">) {
  const { id } = await params;
  const { aviso } = await searchParams;
  const supabase = await criarClienteSupabase();
  const { data: l } = await supabase.from("v_lancamentos").select("*").eq("id", id).maybeSingle();
  if (!l) notFound();

  const [{ data: historico }, { data: usuarios }, { data: cliente }] = await Promise.all([
    supabase
      .from("auditoria")
      .select("id, acao, usuario_id, em, antes, depois")
      .eq("tabela", "lancamentos")
      .eq("registro_id", id)
      .order("id"),
    supabase.from("usuarios").select("id, nome"),
    l.cliente_id ? supabase.from("clientes").select("id, nome").eq("id", l.cliente_id).single() : { data: null },
  ]);
  const nomeUsuario = new Map((usuarios ?? []).map((u) => [u.id, u.nome]));
  const hoje = hojeEmBrasilia();

  return (
    <>
      <Link href="/financeiro/lancamentos" className="mb-4 inline-block text-sm text-texto-secundario hover:text-destaque">
        ← Lançamentos
      </Link>
      <TituloPagina>{l.tipo === "entrada" ? "Entrada" : "Saída"}</TituloPagina>
      {aviso === "salvo" && (
        <div className="mb-4">
          <Mensagem tipo="sucesso">Alterações salvas.</Mensagem>
        </div>
      )}
      <div className="mb-6 flex flex-wrap items-center gap-3 text-sm text-texto-secundario">
        <StatusLancamento status={l.status_efetivo} />
        <span className="tabular-nums">{formatarReais(l.valor_centavos)}</span>
        {cliente && (
          <Link href={`/clientes/${cliente.id}`} className="hover:text-destaque">
            {cliente.nome}
          </Link>
        )}
        {l.mensalidade_id && <span>Cobrança de mensalidade</span>}
        {l.parcela && <span>Parcela {l.parcela} de venda única</span>}
        {l.gasto_recorrente_id && <span>Gerado por gasto recorrente</span>}
        {l.dias_atraso > 0 && <span className="text-perigo">{l.dias_atraso} dia(s) de atraso</span>}
      </div>

      <div className="grid gap-8 lg:grid-cols-[1fr_20rem]">
        <FormularioLancamento
          acao={salvarLancamento.bind(null, l.id)}
          saida={l.tipo === "saida"}
          hoje={hoje}
          inicial={{
            descricao: l.descricao,
            valor: formatarValorCampo(l.valor_centavos),
            forma_pagamento: l.forma_pagamento,
            vencimento: l.vencimento,
            categoria: l.categoria ?? "",
            status: l.status,
            data_pagamento: l.data_pagamento ?? "",
          }}
        />
        <div className="flex flex-col gap-4">
          <Cartao className="flex flex-col gap-3">
            <h2 className="font-semibold">Histórico</h2>
            <ol className="flex flex-col gap-2 text-sm">
              {historico?.map((h) => (
                <li key={h.id}>
                  <span className="font-medium">{ACOES[h.acao as keyof typeof ACOES]}</span>{" "}
                  <span className="text-texto-secundario">
                    por {h.usuario_id ? (nomeUsuario.get(h.usuario_id) ?? "usuário removido") : "sistema"} em{" "}
                    {formatoHora.format(new Date(h.em))}
                  </span>
                </li>
              ))}
            </ol>
          </Cartao>
          <Cartao className="flex flex-col items-start gap-3">
            <h2 className="font-semibold">Excluir</h2>
            <p className="text-sm text-texto-secundario">
              O lançamento sai das listas e dos cálculos. O registro continua no histórico de auditoria.
            </p>
            <ConfirmarAcao
              rotulo="Excluir lançamento"
              titulo="Excluir este lançamento?"
              mensagem={`${l.descricao} — ${formatarReais(l.valor_centavos)}, vencimento ${formatarData(l.vencimento)}.`}
              rotuloConfirmar="Excluir"
              variante="perigo"
              acao={excluirLancamento.bind(null, l.id)}
            />
          </Cartao>
        </div>
      </div>
    </>
  );
}
