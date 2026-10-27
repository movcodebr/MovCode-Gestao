import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ConfirmarAcao } from "@/components/ConfirmarAcao";
import { Cartao, TituloPagina } from "@/components/ui";
import { formatarValorCampo } from "@/lib/dominio/dinheiro";
import { criarClienteSupabase } from "@/lib/supabase/servidor";
import { alterarAtivoProduto, excluirProduto, salvarProduto } from "../acoes";
import { FormularioProduto } from "../FormularioProduto";

export const metadata: Metadata = { title: "Editar produto — Mov Code" };

export default async function PaginaEditarProduto({ params }: PageProps<"/produtos/[id]">) {
  const { id } = await params;
  const supabase = await criarClienteSupabase();
  const { data: produto } = await supabase
    .from("produtos")
    .select("id, nome, preco_centavos, mensalidade_centavos, ativo")
    .eq("id", id)
    .maybeSingle();
  if (!produto) notFound();

  return (
    <>
      <TituloPagina descricao={produto.ativo ? undefined : "Produto desativado: não aparece em vendas novas."}>
        {produto.nome}
      </TituloPagina>
      <div className="flex flex-col gap-8">
        <FormularioProduto
          edicao
          acao={salvarProduto.bind(null, produto.id)}
          inicial={{
            nome: produto.nome,
            preco: formatarValorCampo(produto.preco_centavos),
            mensalidade: formatarValorCampo(produto.mensalidade_centavos),
          }}
        />
        <Cartao className="flex max-w-lg flex-col gap-3">
          <h2 className="font-semibold">Disponibilidade</h2>
          <div className="flex flex-wrap items-start gap-2">
            <ConfirmarAcao
              rotulo={produto.ativo ? "Desativar" : "Reativar"}
              titulo={produto.ativo ? "Desativar produto?" : "Reativar produto?"}
              mensagem={
                produto.ativo
                  ? "O produto deixa de aparecer em vendas novas. Vendas e mensalidades existentes não mudam."
                  : "O produto volta a aparecer em vendas novas."
              }
              acao={alterarAtivoProduto.bind(null, produto.id, !produto.ativo)}
            />
            <ConfirmarAcao
              rotulo="Excluir"
              titulo="Excluir produto?"
              mensagem="Essa ação não pode ser desfeita. Só é possível excluir produtos que nunca foram usados em vendas."
              rotuloConfirmar="Excluir"
              variante="perigo"
              acao={excluirProduto.bind(null, produto.id)}
            />
          </div>
        </Cartao>
      </div>
    </>
  );
}
