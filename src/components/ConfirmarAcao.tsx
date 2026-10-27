"use client";

import { useActionState, useRef } from "react";
import type { EstadoFormulario } from "@/lib/formulario";
import { Botao, Mensagem } from "./ui";

type Props = {
  /** Texto do botão que abre a confirmação */
  rotulo: string;
  titulo: string;
  mensagem: string;
  rotuloConfirmar?: string;
  variante?: "primario" | "secundario" | "perigo";
  acao: (estado: EstadoFormulario, dados: FormData) => Promise<EstadoFormulario>;
};

/** Botão que pede confirmação em uma janela antes de executar a ação. */
export function ConfirmarAcao({
  rotulo,
  titulo,
  mensagem,
  rotuloConfirmar = "Confirmar",
  variante = "secundario",
  acao,
}: Props) {
  const janela = useRef<HTMLDialogElement>(null);
  const [estado, executar, executando] = useActionState(acao, {});

  return (
    <>
      <Botao type="button" variante={variante} onClick={() => janela.current?.showModal()}>
        {rotulo}
      </Botao>
      {estado.erro && <Mensagem tipo="erro">{estado.erro}</Mensagem>}
      <dialog
        ref={janela}
        className="m-auto w-[min(28rem,calc(100%-2rem))] rounded-2xl border border-borda bg-superficie p-6 text-texto backdrop:bg-black/70"
      >
        <form action={executar} onSubmit={() => janela.current?.close()} className="flex flex-col gap-4">
          <h2 className="text-lg font-semibold">{titulo}</h2>
          <p className="text-texto-secundario">{mensagem}</p>
          <div className="flex flex-wrap justify-end gap-2">
            <Botao type="button" variante="secundario" onClick={() => janela.current?.close()}>
              Cancelar
            </Botao>
            <Botao type="submit" variante={variante === "secundario" ? "primario" : variante} disabled={executando}>
              {rotuloConfirmar}
            </Botao>
          </div>
        </form>
      </dialog>
    </>
  );
}
