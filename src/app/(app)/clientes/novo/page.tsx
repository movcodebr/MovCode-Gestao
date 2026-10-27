import type { Metadata } from "next";
import { TituloPagina } from "@/components/ui";
import { salvarCliente } from "../acoes";
import { FormularioCliente } from "../FormularioCliente";

export const metadata: Metadata = { title: "Novo cliente — Mov Code" };

export default function PaginaNovoCliente() {
  return (
    <>
      <TituloPagina>Novo cliente</TituloPagina>
      <FormularioCliente acao={salvarCliente.bind(null, null)} voltarPara="/clientes" />
    </>
  );
}
