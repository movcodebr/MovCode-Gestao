import type { Metadata } from "next";
import { FormularioLogin } from "./FormularioLogin";

export const metadata: Metadata = { title: "Entrar — Mov Code" };

const AVISOS: Record<string, string> = {
  "link-invalido": "O link expirou ou já foi usado. Peça um novo em \"Esqueci minha senha\".",
  "senha-alterada": "Senha alterada. Entre com a nova senha.",
  saiu: "Você saiu do sistema.",
};

export default async function PaginaLogin({ searchParams }: PageProps<"/login">) {
  const { destino, aviso } = await searchParams;
  return (
    <FormularioLogin
      destino={typeof destino === "string" ? destino : undefined}
      aviso={typeof aviso === "string" ? AVISOS[aviso] : undefined}
    />
  );
}
