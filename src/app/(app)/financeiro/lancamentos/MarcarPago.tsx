"use client";

import { useActionState, useEffect, useRef } from "react";
import { Botao, Campo, Mensagem, Selecao } from "@/components/ui";
import { FORMAS_PAGAMENTO } from "@/lib/dominio/lancamentos";
import type { EstadoFormulario } from "@/lib/formulario";

type Props = {
  descricao: string;
  formaAtual: string;
  hoje: string;
  acao: (estado: EstadoFormulario, dados: FormData) => Promise<EstadoFormulario>;
};

/** Botão "Marcar como pago" que pede a data do pagamento e a forma usada. */
export function MarcarPago({ descricao, formaAtual, hoje, acao }: Props) {
  const janela = useRef<HTMLDialogElement>(null);
  const [estado, enviar, enviando] = useActionState(acao, {});

  useEffect(() => {
    if (estado.sucesso) janela.current?.close();
  }, [estado]);

  return (
    <>
      <button
        type="button"
        onClick={() => janela.current?.showModal()}
        className="rounded-full border border-borda px-3 py-1 text-xs font-medium hover:border-sucesso hover:text-sucesso"
      >
        Marcar pago
      </button>
      <dialog
        ref={janela}
        className="m-auto w-[min(26rem,calc(100%-2rem))] rounded-2xl border border-borda bg-superficie p-6 text-texto backdrop:bg-black/70"
      >
        <form action={enviar} className="flex flex-col gap-4">
          <h2 className="text-lg font-semibold">Registrar pagamento</h2>
          <p className="text-sm text-texto-secundario">{descricao}</p>
          {estado.erro && <Mensagem tipo="erro">{estado.erro}</Mensagem>}
          <Campo rotulo="Data do pagamento" name="data_pagamento" type="date" defaultValue={hoje} max={hoje} required />
          <Selecao rotulo="Forma de pagamento" name="forma_pagamento" defaultValue={formaAtual}>
            {Object.entries(FORMAS_PAGAMENTO).map(([valor, rotulo]) => (
              <option key={valor} value={valor}>
                {rotulo}
              </option>
            ))}
          </Selecao>
          <div className="flex justify-end gap-2">
            <Botao type="button" variante="secundario" onClick={() => janela.current?.close()}>
              Cancelar
            </Botao>
            <Botao type="submit" disabled={enviando}>
              Confirmar pagamento
            </Botao>
          </div>
        </form>
      </dialog>
    </>
  );
}
