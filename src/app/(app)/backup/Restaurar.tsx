"use client";

import { useActionState, useRef } from "react";
import { Botao, Campo, Mensagem } from "@/components/ui";
import type { EstadoFormulario } from "@/lib/formulario";

type Props = {
  descricao: string;
  comArquivo?: boolean;
  rotulo?: string;
  acao: (estado: EstadoFormulario, dados: FormData) => Promise<EstadoFormulario>;
};

/** Restauração com confirmação forte: é preciso digitar RESTAURAR. */
export function Restaurar({ descricao, comArquivo = false, rotulo = "Restaurar", acao }: Props) {
  const janela = useRef<HTMLDialogElement>(null);
  const [estado, enviar, enviando] = useActionState(acao, {});

  return (
    <div className="flex flex-col items-start gap-2">
      <button
        type="button"
        onClick={() => janela.current?.showModal()}
        className="rounded-full border border-borda px-3 py-1.5 text-xs font-medium hover:border-perigo hover:text-perigo"
      >
        {rotulo}
      </button>
      {estado.erro && <Mensagem tipo="erro">{estado.erro}</Mensagem>}
      {estado.sucesso && <Mensagem tipo="sucesso">{estado.sucesso}</Mensagem>}
      <dialog
        ref={janela}
        className="m-auto w-[min(30rem,calc(100%-2rem))] rounded-2xl border border-borda bg-superficie p-6 text-texto backdrop:bg-black/70"
      >
        <form action={enviar} onSubmit={() => janela.current?.close()} className="flex flex-col gap-4">
          <h2 className="text-lg font-semibold text-perigo">Restaurar backup?</h2>
          <p className="text-sm text-texto-secundario">{descricao}</p>
          <p className="text-sm">
            <strong>Todos os dados atuais</strong> (clientes, lançamentos, mensalidades, produtos, documentos cadastrados
            etc.) serão substituídos pelos do backup. Antes, o sistema guarda automaticamente um backup do estado atual.
            Os logins dos usuários não mudam.
          </p>
          {comArquivo && <Campo rotulo="Arquivo de backup (.json.gz)" name="arquivo" type="file" accept=".gz,.json,application/gzip,application/json" required />}
          <Campo rotulo="Digite RESTAURAR para confirmar" name="confirmacao" autoComplete="off" required />
          <div className="flex flex-wrap justify-end gap-2">
            <Botao type="button" variante="secundario" onClick={() => janela.current?.close()}>
              Cancelar
            </Botao>
            <Botao type="submit" variante="perigo" disabled={enviando}>
              {enviando ? "Restaurando..." : "Restaurar"}
            </Botao>
          </div>
        </form>
      </dialog>
    </div>
  );
}
