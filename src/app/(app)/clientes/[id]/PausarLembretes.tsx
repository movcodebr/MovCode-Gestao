"use client";

import { useActionState, useState } from "react";
import { Botao, Campo, Mensagem } from "@/components/ui";
import type { EstadoFormulario } from "@/lib/formulario";

type Props = {
  acao: (estado: EstadoFormulario, dados: FormData) => Promise<EstadoFormulario>;
  amanha: string;
};

/** Botão "Pausar lembretes" que abre o formulário com data final (obrigatória) e motivo. */
export function PausarLembretes({ acao, amanha }: Props) {
  const [aberto, setAberto] = useState(false);
  const [estado, enviar, enviando] = useActionState(acao, {});

  if (!aberto && !estado.erro) {
    return (
      <Botao type="button" variante="secundario" onClick={() => setAberto(true)}>
        Pausar lembretes
      </Botao>
    );
  }
  return (
    <form action={enviar} className="flex w-full max-w-xl flex-col gap-3 rounded-xl border border-borda p-4">
      <p className="text-sm text-texto-secundario">
        Durante a pausa, nenhum lembrete é enviado para este cliente (nenhum canal, nenhuma mensalidade). As cobranças,
        a inadimplência e o MRR continuam normais. Na data final os lembretes voltam sozinhos.
      </p>
      {estado.erro && <Mensagem tipo="erro">{estado.erro}</Mensagem>}
      <div className="grid gap-3 sm:grid-cols-[12rem_1fr]">
        <Campo rotulo="Pausar até" name="fim" type="date" min={amanha} defaultValue={estado.valores?.fim} required />
        <Campo
          rotulo="Motivo (opcional)"
          name="motivo"
          placeholder="ex.: prazo negociado até dia 20"
          maxLength={300}
          defaultValue={estado.valores?.motivo}
        />
      </div>
      <div className="flex gap-2">
        <Botao type="submit" disabled={enviando}>
          Pausar
        </Botao>
        <Botao type="button" variante="secundario" onClick={() => setAberto(false)}>
          Cancelar
        </Botao>
      </div>
    </form>
  );
}
