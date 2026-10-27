"use client";

import { useActionState } from "react";
import { Botao, Campo, Mensagem } from "@/components/ui";
import type { EstadoFormulario } from "@/lib/formulario";

type Props = { acao: (estado: EstadoFormulario, dados: FormData) => Promise<EstadoFormulario> };

/** Campo para informar o IPCA acumulado quando a API do Banco Central não respondeu. */
export function IndiceManual({ acao }: Props) {
  const [estado, enviar, enviando] = useActionState(acao, {});
  return (
    <form action={enviar} className="flex flex-col gap-2">
      {estado.erro && <Mensagem tipo="erro">{estado.erro}</Mensagem>}
      <div className="flex flex-wrap items-end gap-2">
        <div className="w-40">
          <Campo
            rotulo="IPCA acumulado, %"
            name="percentual"
            inputMode="decimal"
            placeholder="4,68"
            defaultValue={estado.valores?.percentual}
            required
          />
        </div>
        <Botao type="submit" variante="secundario" disabled={enviando}>
          Aplicar reajuste
        </Botao>
      </div>
    </form>
  );
}
