import type { Metadata } from "next";
import { LinkBotao, Mensagem, TituloPagina } from "@/components/ui";
import { hojeEmBrasilia } from "@/lib/dominio/datas";
import { criarClienteSupabase } from "@/lib/supabase/servidor";
import { FormularioVenda } from "./FormularioVenda";

export const metadata: Metadata = { title: "Lançar venda — Mov Code" };

export default async function PaginaNovaVenda({ searchParams }: PageProps<"/financeiro/vendas/nova">) {
  const { cliente } = await searchParams;
  const supabase = await criarClienteSupabase();
  const [{ data: clientes }, { data: produtos }] = await Promise.all([
    supabase.from("clientes").select("id, nome").eq("ativo", true).order("nome"),
    supabase.from("produtos").select("id, nome, preco_centavos, mensalidade_centavos").eq("ativo", true).order("nome"),
  ]);

  return (
    <>
      <TituloPagina descricao="Entrada de dinheiro: venda única, mensalidade ou as duas.">Lançar venda</TituloPagina>
      {clientes?.length === 0 ? (
        <div className="flex flex-col items-start gap-3">
          <Mensagem tipo="info">Cadastre um cliente ativo antes de lançar uma venda.</Mensagem>
          <LinkBotao href="/clientes/novo">Novo cliente</LinkBotao>
        </div>
      ) : (
        <FormularioVenda
          hoje={hojeEmBrasilia()}
          clienteInicial={typeof cliente === "string" ? cliente : undefined}
          clientes={clientes ?? []}
          produtos={(produtos ?? []).map((p) => ({
            id: p.id,
            nome: p.nome,
            preco: p.preco_centavos,
            mensalidade: p.mensalidade_centavos,
          }))}
        />
      )}
    </>
  );
}
