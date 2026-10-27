import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ConfirmarAcao } from "@/components/ConfirmarAcao";
import { SituacaoCliente } from "@/components/SituacaoCliente";
import { Cartao, LinkBotao, TituloPagina } from "@/components/ui";
import { formatarDocumento, formatarTelefone, NOME_TIPO, type TipoCliente } from "@/lib/dominio/documento";
import { mensalidadesDoCliente } from "@/lib/consultas/mensalidades";
import { criarClienteSupabase } from "@/lib/supabase/servidor";
import { alterarStatusCliente, salvarCliente } from "../acoes";
import { FormularioCliente } from "../FormularioCliente";
import { Mensalidades } from "./Mensalidades";

export const metadata: Metadata = { title: "Cliente — Mov Code" };

export default async function PaginaCliente({ params, searchParams }: PageProps<"/clientes/[id]">) {
  const { id } = await params;
  const { editar } = await searchParams;
  const supabase = await criarClienteSupabase();
  const { data: cliente } = await supabase
    .from("v_clientes")
    .select("id, nome, telefone, email, documento, tipo, ativo, em_atraso, lembretes_pausados_ate")
    .eq("id", id)
    .maybeSingle();
  if (!cliente) notFound();

  if (editar !== undefined) {
    return (
      <>
        <TituloPagina>Editar cliente</TituloPagina>
        <FormularioCliente
          acao={salvarCliente.bind(null, cliente.id)}
          voltarPara={`/clientes/${cliente.id}`}
          inicial={{
            nome: cliente.nome,
            telefone: formatarTelefone(cliente.telefone),
            email: cliente.email,
            documento: formatarDocumento(cliente.documento),
            status: cliente.ativo ? "ativo" : "inativo",
          }}
        />
      </>
    );
  }

  return (
    <>
      <Link href="/clientes" className="mb-4 inline-block text-sm text-texto-secundario hover:text-destaque">
        ← Clientes
      </Link>
      <TituloPagina>{cliente.nome}</TituloPagina>
      <div className="mb-6 -mt-3">
        <SituacaoCliente
          ativo={cliente.ativo}
          emAtraso={cliente.em_atraso}
          pausadoAte={cliente.lembretes_pausados_ate}
        />
      </div>

      <Cartao className="flex flex-col gap-4">
        <dl className="grid gap-4 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-texto-secundario">{cliente.tipo === "PF" ? "CPF" : "CNPJ"}</dt>
            <dd>{formatarDocumento(cliente.documento)}</dd>
          </div>
          <div>
            <dt className="text-texto-secundario">Tipo</dt>
            <dd>{NOME_TIPO[cliente.tipo as TipoCliente]}</dd>
          </div>
          <div>
            <dt className="text-texto-secundario">Telefone</dt>
            <dd>{formatarTelefone(cliente.telefone)}</dd>
          </div>
          <div>
            <dt className="text-texto-secundario">E-mail</dt>
            <dd className="break-all">{cliente.email}</dd>
          </div>
        </dl>
        <div className="flex flex-wrap items-start gap-2 border-t border-borda pt-4">
          {cliente.ativo && <LinkBotao href={`/financeiro/vendas/nova?cliente=${cliente.id}`}>Lançar venda</LinkBotao>}
          <Link
            href={`/clientes/${cliente.id}?editar`}
            className="inline-flex items-center rounded-full border border-borda px-5 py-2.5 text-sm font-semibold hover:bg-fundo"
          >
            Editar dados
          </Link>
          <ConfirmarAcao
            rotulo={cliente.ativo ? "Inativar cliente" : "Reativar cliente"}
            titulo={cliente.ativo ? "Inativar cliente?" : "Reativar cliente?"}
            mensagem={
              cliente.ativo
                ? "As mensalidades deste cliente param de gerar cobranças e lembretes, e saem do MRR. As cobranças já existentes continuam no histórico."
                : "As mensalidades ativas voltam a gerar cobranças a partir do próximo vencimento. Os meses em que ficou inativo não são cobrados."
            }
            rotuloConfirmar={cliente.ativo ? "Inativar" : "Reativar"}
            variante={cliente.ativo ? "perigo" : "secundario"}
            acao={alterarStatusCliente.bind(null, cliente.id, !cliente.ativo)}
          />
        </div>
      </Cartao>
      <div className="mt-6">
        <Mensalidades mensalidades={await mensalidadesDoCliente(supabase, cliente.id)} clienteId={cliente.id} />
      </div>
    </>
  );
}
