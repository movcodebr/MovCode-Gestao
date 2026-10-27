"use client";

import { useActionState } from "react";
import { Botao, Mensagem } from "@/components/ui";
import { fazerBackupAgora } from "./acoes";

export function FazerBackup() {
  const [estado, enviar, enviando] = useActionState(fazerBackupAgora, {});
  return (
    <form action={enviar} className="flex flex-col items-start gap-2">
      <Botao type="submit" disabled={enviando}>
        {enviando ? "Fazendo backup..." : "Fazer backup agora"}
      </Botao>
      {estado.erro && <Mensagem tipo="erro">{estado.erro}</Mensagem>}
      {estado.sucesso && <Mensagem tipo="sucesso">{estado.sucesso}</Mensagem>}
    </form>
  );
}
