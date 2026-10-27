"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Botao, Campo, Mensagem } from "@/components/ui";
import type { EstadoFormulario } from "@/lib/formulario";

type Props = {
  acao: (estado: EstadoFormulario, dados: FormData) => Promise<EstadoFormulario>;
  inicial?: { nome: string; preco: string; mensalidade: string };
  edicao?: boolean;
};

export function FormularioProduto({ acao, inicial, edicao = false }: Props) {
  const [estado, enviar, enviando] = useActionState(acao, {});
  const valor = (campo: "nome" | "preco" | "mensalidade") => estado.valores?.[campo] ?? inicial?.[campo];

  return (
    <form action={enviar} className="flex max-w-lg flex-col gap-4">
      {estado.erro && <Mensagem tipo="erro">{estado.erro}</Mensagem>}
      <Campo rotulo="Produto" name="nome" defaultValue={valor("nome")} erro={estado.campos?.nome} required />
      <div className="grid gap-4 sm:grid-cols-2">
        <Campo
          rotulo="Preço (a partir de), R$"
          name="preco"
          inputMode="decimal"
          placeholder="0,00"
          defaultValue={valor("preco")}
          erro={estado.campos?.preco}
          required
        />
        <Campo
          rotulo="Mensalidade, R$"
          name="mensalidade"
          inputMode="decimal"
          placeholder="0,00"
          defaultValue={valor("mensalidade")}
          erro={estado.campos?.mensalidade}
          required
        />
      </div>
      {edicao && (
        <Mensagem tipo="info">
          A mudança de preço vale só para vendas novas. Mensalidades já contratadas mudam apenas pelo reajuste anual
          do IPCA.
        </Mensagem>
      )}
      <div className="flex gap-2">
        <Botao type="submit" disabled={enviando}>
          {enviando ? "Salvando..." : "Salvar"}
        </Botao>
        <Link href="/produtos" className="px-4 py-2.5 text-sm text-texto-secundario hover:text-texto">
          Cancelar
        </Link>
      </div>
    </form>
  );
}
