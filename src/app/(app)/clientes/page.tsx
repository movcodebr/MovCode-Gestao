import type { Metadata } from "next";
import Link from "next/link";
import { SituacaoCliente } from "@/components/SituacaoCliente";
import { Botao, LinkBotao, Mensagem, Selecao, TituloPagina } from "@/components/ui";
import { formatarDocumento, formatarTelefone, normalizarDocumento } from "@/lib/dominio/documento";
import { criarClienteSupabase } from "@/lib/supabase/servidor";

export const metadata: Metadata = { title: "Clientes — Mov Code" };

const FILTROS_STATUS = { ativos: "Ativos", inativos: "Inativos", todos: "Todos" } as const;
const FILTROS_SITUACAO = { todas: "Todas", atraso: "Em atraso", pausados: "Lembretes pausados" } as const;

/** Remove caracteres que têm significado especial nos filtros do Supabase. */
function limparBusca(texto: string): string {
  return texto.replace(/[,()*%\\]/g, " ").trim();
}

export default async function PaginaClientes({ searchParams }: PageProps<"/clientes">) {
  const params = await searchParams;
  const busca = typeof params.busca === "string" ? limparBusca(params.busca) : "";
  const status = (typeof params.status === "string" && params.status in FILTROS_STATUS ? params.status : "ativos") as
    keyof typeof FILTROS_STATUS;
  const situacao = (
    typeof params.situacao === "string" && params.situacao in FILTROS_SITUACAO ? params.situacao : "todas"
  ) as keyof typeof FILTROS_SITUACAO;

  const supabase = await criarClienteSupabase();
  let consulta = supabase
    .from("v_clientes")
    .select("id, nome, telefone, email, documento, ativo, em_atraso, lembretes_pausados_ate")
    .order("nome");
  if (status !== "todos") consulta = consulta.eq("ativo", status === "ativos");
  if (situacao === "atraso") consulta = consulta.eq("em_atraso", true);
  if (situacao === "pausados") consulta = consulta.not("lembretes_pausados_ate", "is", null);
  if (busca) {
    const doc = normalizarDocumento(busca);
    consulta = consulta.or(
      [`nome.ilike.*${busca}*`, `email.ilike.*${busca}*`, doc && `documento.ilike.*${doc}*`].filter(Boolean).join(","),
    );
  }
  const { data: clientes, error } = await consulta;

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <TituloPagina>Clientes</TituloPagina>
        <LinkBotao href="/clientes/novo">Novo cliente</LinkBotao>
      </div>

      <form className="mb-6 grid gap-3 sm:grid-cols-[1fr_auto_auto_auto] sm:items-end">
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="text-texto-secundario">Buscar</span>
          <input
            name="busca"
            defaultValue={busca}
            placeholder="Nome, e-mail ou CPF/CNPJ"
            className="rounded-lg border border-borda bg-superficie px-3 py-2.5 text-base outline-none focus:border-destaque"
          />
        </label>
        <Selecao rotulo="Status" name="status" defaultValue={status}>
          {Object.entries(FILTROS_STATUS).map(([valor, rotulo]) => (
            <option key={valor} value={valor}>
              {rotulo}
            </option>
          ))}
        </Selecao>
        <Selecao rotulo="Situação" name="situacao" defaultValue={situacao}>
          {Object.entries(FILTROS_SITUACAO).map(([valor, rotulo]) => (
            <option key={valor} value={valor}>
              {rotulo}
            </option>
          ))}
        </Selecao>
        <Botao type="submit" variante="secundario">
          Filtrar
        </Botao>
      </form>

      {error && <Mensagem tipo="erro">Não foi possível carregar os clientes.</Mensagem>}

      <ul className="divide-y divide-borda overflow-hidden rounded-2xl border border-borda">
        {clientes?.map((c) => (
          <li key={c.id}>
            <Link
              href={`/clientes/${c.id}`}
              className="flex flex-col gap-2 px-4 py-3 hover:bg-superficie sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <p className="font-medium">{c.nome}</p>
                <p className="truncate text-sm text-texto-secundario">
                  {formatarDocumento(c.documento)} · {formatarTelefone(c.telefone)} · {c.email}
                </p>
              </div>
              <SituacaoCliente ativo={c.ativo} emAtraso={c.em_atraso} pausadoAte={c.lembretes_pausados_ate} />
            </Link>
          </li>
        ))}
        {clientes?.length === 0 && (
          <li className="px-4 py-6 text-center text-texto-secundario">Nenhum cliente encontrado.</li>
        )}
      </ul>
    </>
  );
}
