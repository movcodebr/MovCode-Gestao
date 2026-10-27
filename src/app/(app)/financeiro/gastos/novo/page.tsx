import type { Metadata } from "next";
import { TituloPagina } from "@/components/ui";
import { hojeEmBrasilia } from "@/lib/dominio/datas";
import { FormularioGasto } from "./FormularioGasto";

export const metadata: Metadata = { title: "Lançar gasto — Mov Code" };

export default function PaginaNovoGasto() {
  return (
    <>
      <TituloPagina descricao="Saída de dinheiro: avulsa ou recorrente mensal.">Lançar gasto</TituloPagina>
      <FormularioGasto hoje={hojeEmBrasilia()} />
    </>
  );
}
