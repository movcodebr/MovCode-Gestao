"use client";

import { useActionState } from "react";
import { Botao, Campo, Mensagem } from "@/components/ui";
import { redefinirSenha } from "../../acoes-sessao";

export function FormularioNovaSenha({ email }: { email: string }) {
  const [estado, acao, enviando] = useActionState(redefinirSenha, {});

  return (
    <form action={acao} className="flex flex-col gap-4">
      <h1 className="font-titulo text-2xl uppercase">Nova senha</h1>
      <p className="text-sm text-texto-secundario">Crie uma senha nova para {email}.</p>
      {estado.erro && <Mensagem tipo="erro">{estado.erro}</Mensagem>}
      <Campo rotulo="Nova senha" name="senha" type="password" autoComplete="new-password" minLength={8} required />
      <Campo rotulo="Repita a nova senha" name="confirmacao" type="password" autoComplete="new-password" required />
      <Botao type="submit" disabled={enviando}>
        {enviando ? "Salvando..." : "Salvar nova senha"}
      </Botao>
    </form>
  );
}
