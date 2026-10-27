import type { Metadata } from "next";
import { usuarioAtual } from "@/lib/auth";
import { FormularioNovaSenha } from "./FormularioNovaSenha";

export const metadata: Metadata = { title: "Nova senha — Mov Code" };

// Só abre com sessão: vinda do link do e-mail ou de um usuário logado.
export default async function PaginaRedefinirSenha() {
  const usuario = await usuarioAtual();
  return <FormularioNovaSenha email={usuario.email} />;
}
