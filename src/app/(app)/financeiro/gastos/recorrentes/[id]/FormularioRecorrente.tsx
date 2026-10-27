"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Botao, Campo, Mensagem, Selecao } from "@/components/ui";
import { CATEGORIAS_GASTO, FORMAS_PAGAMENTO } from "@/lib/dominio/lancamentos";
import type { EstadoFormulario } from "@/lib/formulario";

type Valores = { descricao: string; categoria: string; valor: string; forma_pagamento: string; data_fim: string };

type Props = {
  acao: (estado: EstadoFormulario, dados: FormData) => Promise<EstadoFormulario>;
  inicial: Valores;
};

export function FormularioRecorrente({ acao, inicial }: Props) {
  const [estado, enviar, enviando] = useActionState(acao, {});
  const v = (campo: keyof Valores) => estado.valores?.[campo] ?? inicial[campo];

  return (
    <form action={enviar} className="flex max-w-2xl flex-col gap-4">
      {estado.erro && <Mensagem tipo="erro">{estado.erro}</Mensagem>}
      <Campo rotulo="Descrição" name="descricao" defaultValue={v("descricao")} erro={estado.campos?.descricao} required />
      <div className="grid gap-4 sm:grid-cols-2">
        <Selecao rotulo="Categoria" name="categoria" defaultValue={v("categoria")}>
          {Object.entries(CATEGORIAS_GASTO).map(([valor, rotulo]) => (
            <option key={valor} value={valor}>
              {rotulo}
            </option>
          ))}
        </Selecao>
        <Campo
          rotulo="Valor mensal, R$"
          name="valor"
          inputMode="decimal"
          defaultValue={v("valor")}
          erro={estado.campos?.valor}
          ajuda="Vale para os próximos meses; os gastos já lançados não mudam."
          required
        />
        <Selecao rotulo="Forma de pagamento" name="forma_pagamento" defaultValue={v("forma_pagamento")}>
          {Object.entries(FORMAS_PAGAMENTO).map(([valor, rotulo]) => (
            <option key={valor} value={valor}>
              {rotulo}
            </option>
          ))}
        </Selecao>
        <Campo
          rotulo="Repetir até (opcional)"
          name="data_fim"
          type="date"
          defaultValue={v("data_fim")}
          erro={estado.campos?.data_fim}
        />
      </div>
      <div className="flex gap-2">
        <Botao type="submit" disabled={enviando}>
          {enviando ? "Salvando..." : "Salvar"}
        </Botao>
        <Link href="/financeiro/gastos/recorrentes" className="px-4 py-2.5 text-sm text-texto-secundario hover:text-texto">
          Voltar
        </Link>
      </div>
    </form>
  );
}
