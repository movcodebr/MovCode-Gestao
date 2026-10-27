"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Botao, Campo, Mensagem } from "@/components/ui";
import { enviarRecuperacao } from "../acoes";

export default function PaginaEsqueciSenha() {
  const [estado, acao, enviando] = useActionState(enviarRecuperacao, {});

  return (
    <form action={acao} className="flex flex-col gap-4">
      <h1 className="font-titulo text-2xl uppercase">Esqueci minha senha</h1>
      <p className="text-sm text-texto-secundario">
        Informe seu e-mail. Se ele tiver acesso, mandamos um link para criar uma senha nova.
      </p>
      {estado.erro && <Mensagem tipo="erro">{estado.erro}</Mensagem>}
      {estado.sucesso ? (
        <Mensagem tipo="sucesso">{estado.sucesso}</Mensagem>
      ) : (
        <>
          <Campo
            rotulo="E-mail"
            name="email"
            type="email"
            autoComplete="email"
            defaultValue={estado.valores?.email}
            required
          />
          <Botao type="submit" disabled={enviando}>
            {enviando ? "Enviando..." : "Enviar link"}
          </Botao>
        </>
      )}
      <Link href="/login" className="text-center text-sm text-texto-secundario hover:text-destaque">
        Voltar para o login
      </Link>
    </form>
  );
}
