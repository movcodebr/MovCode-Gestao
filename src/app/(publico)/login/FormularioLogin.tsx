"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Botao, Campo, Mensagem } from "@/components/ui";
import { entrar } from "../acoes";

export function FormularioLogin({ destino, aviso }: { destino?: string; aviso?: string }) {
  const [estado, acao, enviando] = useActionState(entrar, {});

  return (
    <form action={acao} className="flex flex-col gap-4">
      <h1 className="font-titulo text-2xl uppercase">Entrar</h1>
      {aviso && <Mensagem tipo="info">{aviso}</Mensagem>}
      {estado.erro && <Mensagem tipo="erro">{estado.erro}</Mensagem>}
      <input type="hidden" name="destino" value={destino ?? ""} />
      <Campo rotulo="E-mail" name="email" type="email" autoComplete="email" defaultValue={estado.valores?.email} required />
      <Campo rotulo="Senha" name="senha" type="password" autoComplete="current-password" required />
      <Botao type="submit" disabled={enviando}>
        {enviando ? "Entrando..." : "Entrar"}
      </Botao>
      <Link href="/esqueci-senha" className="text-center text-sm text-texto-secundario hover:text-destaque">
        Esqueci minha senha
      </Link>
    </form>
  );
}
