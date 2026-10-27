import type { Metadata } from "next";
import { TituloPagina } from "@/components/ui";
import { salvarProduto } from "../acoes";
import { FormularioProduto } from "../FormularioProduto";

export const metadata: Metadata = { title: "Novo produto — Mov Code" };

export default function PaginaNovoProduto() {
  return (
    <>
      <TituloPagina>Novo produto</TituloPagina>
      <FormularioProduto acao={salvarProduto.bind(null, null)} />
    </>
  );
}
