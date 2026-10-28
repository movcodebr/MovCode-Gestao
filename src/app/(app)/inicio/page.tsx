import type { Metadata } from "next";
import Link from "next/link";
import { Logo } from "@/components/Logo";
import { usuarioAtual } from "@/lib/auth";

export const metadata: Metadata = { title: "Início — Mov Code" };

const ATALHOS = [
  { href: "/financeiro", titulo: "Financeiro", texto: "Dashboard, vendas e gastos" },
  { href: "/clientes", titulo: "Clientes", texto: "Cadastro e mensalidades" },
  { href: "/prospeccao", titulo: "Prospecção", texto: "Leads do Instagram e follow-ups do dia" },
  { href: "/produtos", titulo: "Produtos", texto: "Preços e mensalidades" },
  { href: "/documentos", titulo: "Documentos", texto: "Planilhas e arquivos internos" },
];

export default async function PaginaInicio() {
  const usuario = await usuarioAtual();
  const primeiroNome = usuario.nome.split(" ")[0];

  return (
    <div className="flex flex-col gap-10">
      <section className="flex flex-col items-start gap-6 pt-4 md:pt-10">
        <Logo tamanho={56} />
        <h1 className="font-titulo text-4xl uppercase leading-tight sm:text-6xl">
          Fala, <span className="text-destaque">{primeiroNome}</span>!
        </h1>
        <p className="max-w-xl text-lg text-texto-secundario">
          Tecnologia do tamanho do seu negócio. Por onde vamos começar hoje?
        </p>
      </section>

      <section className="grid gap-4 sm:grid-cols-2">
        {ATALHOS.map((atalho) => (
          <Link
            key={atalho.href}
            href={atalho.href}
            className="group rounded-2xl border border-borda bg-superficie p-5 transition hover:border-destaque"
          >
            <h2 className="text-lg font-semibold group-hover:text-destaque">{atalho.titulo}</h2>
            <p className="text-sm text-texto-secundario">{atalho.texto}</p>
          </Link>
        ))}
      </section>
    </div>
  );
}
