import type { Metadata } from "next";
import Link from "next/link";
import { Etiqueta, LinkBotao, Mensagem, TituloPagina } from "@/components/ui";
import { formatarReais } from "@/lib/dominio/dinheiro";
import { criarClienteSupabase } from "@/lib/supabase/servidor";

export const metadata: Metadata = { title: "Produtos — Mov Code" };

export default async function PaginaProdutos() {
  const supabase = await criarClienteSupabase();
  const { data: produtos, error } = await supabase
    .from("produtos")
    .select("id, nome, preco_centavos, mensalidade_centavos, ativo")
    .order("ativo", { ascending: false })
    .order("preco_centavos");

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <TituloPagina descricao="Preços de referência para vendas novas.">Produtos</TituloPagina>
        <LinkBotao href="/produtos/novo">Novo produto</LinkBotao>
      </div>
      {error && <Mensagem tipo="erro">Não foi possível carregar os produtos.</Mensagem>}

      <div className="overflow-hidden rounded-2xl border border-borda">
        <table className="w-full text-left text-sm">
          <thead className="bg-superficie text-texto-secundario">
            <tr>
              <th className="px-4 py-3 font-medium">Produto</th>
              <th className="px-4 py-3 text-right font-medium">Preço (a partir de)</th>
              <th className="px-4 py-3 text-right font-medium">Mensalidade</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-borda">
            {produtos?.map((p) => (
              <tr key={p.id} className="hover:bg-superficie">
                <td className="px-4 py-3">
                  <Link href={`/produtos/${p.id}`} className="font-medium hover:text-destaque">
                    {p.nome}
                  </Link>{" "}
                  {!p.ativo && <Etiqueta cor="cinza">Desativado</Etiqueta>}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums">
                  {formatarReais(p.preco_centavos)}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums">
                  {formatarReais(p.mensalidade_centavos)}
                </td>
              </tr>
            ))}
            {produtos?.length === 0 && (
              <tr>
                <td colSpan={3} className="px-4 py-6 text-center text-texto-secundario">
                  Nenhum produto cadastrado.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
