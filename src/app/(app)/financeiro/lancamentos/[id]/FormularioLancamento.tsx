"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { Botao, Campo, Mensagem, Selecao } from "@/components/ui";
import { CATEGORIAS_GASTO, FORMAS_PAGAMENTO } from "@/lib/dominio/lancamentos";
import type { EstadoFormulario } from "@/lib/formulario";

type Valores = {
  descricao: string;
  valor: string;
  forma_pagamento: string;
  vencimento: string;
  categoria: string;
  status: string;
  data_pagamento: string;
};

type Props = {
  acao: (estado: EstadoFormulario, dados: FormData) => Promise<EstadoFormulario>;
  inicial: Valores;
  saida: boolean;
  hoje: string;
};

export function FormularioLancamento({ acao, inicial, saida, hoje }: Props) {
  const [estado, enviar, enviando] = useActionState(acao, {});
  const v = (campo: keyof Valores) => estado.valores?.[campo] ?? inicial[campo];
  const [status, setStatus] = useState(v("status"));

  return (
    <form action={enviar} className="flex max-w-2xl flex-col gap-4">
      {estado.erro && <Mensagem tipo="erro">{estado.erro}</Mensagem>}
      <Campo rotulo="Descrição" name="descricao" defaultValue={v("descricao")} erro={estado.campos?.descricao} required />
      <div className="grid gap-4 sm:grid-cols-2">
        <Campo rotulo="Valor, R$" name="valor" inputMode="decimal" defaultValue={v("valor")} erro={estado.campos?.valor} required />
        <Campo rotulo="Vencimento" name="vencimento" type="date" defaultValue={v("vencimento")} erro={estado.campos?.vencimento} required />
        <Selecao rotulo="Forma de pagamento" name="forma_pagamento" defaultValue={v("forma_pagamento")}>
          {Object.entries(FORMAS_PAGAMENTO).map(([valor, rotulo]) => (
            <option key={valor} value={valor}>
              {rotulo}
            </option>
          ))}
        </Selecao>
        {saida && (
          <Selecao rotulo="Categoria" name="categoria" defaultValue={v("categoria")} erro={estado.campos?.categoria}>
            {Object.entries(CATEGORIAS_GASTO).map(([valor, rotulo]) => (
              <option key={valor} value={valor}>
                {rotulo}
              </option>
            ))}
          </Selecao>
        )}
        <Selecao
          rotulo="Status"
          name="status"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          ajuda="Pendente com vencimento passado aparece como Atrasado automaticamente."
        >
          <option value="pendente">Pendente</option>
          <option value="pago">Pago</option>
        </Selecao>
        {status === "pago" && (
          <Campo
            rotulo="Data do pagamento"
            name="data_pagamento"
            type="date"
            max={hoje}
            defaultValue={v("data_pagamento") || hoje}
            erro={estado.campos?.data_pagamento}
            required
          />
        )}
      </div>
      <div className="flex gap-2">
        <Botao type="submit" disabled={enviando}>
          {enviando ? "Salvando..." : "Salvar alterações"}
        </Botao>
        <Link href="/financeiro/lancamentos" className="px-4 py-2.5 text-sm text-texto-secundario hover:text-texto">
          Voltar
        </Link>
      </div>
    </form>
  );
}
