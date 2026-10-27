"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { sair } from "@/app/acoes-sessao";
import { Logo } from "./Logo";

const ITENS = [
  { href: "/inicio", rotulo: "Início" },
  { href: "/financeiro", rotulo: "Financeiro" },
  { href: "/produtos", rotulo: "Produtos" },
  { href: "/clientes", rotulo: "Clientes" },
  { href: "/documentos", rotulo: "Documentos" },
];

/** Menu lateral no computador; no celular vira barra superior com botão. */
export function Menu({ nomeUsuario }: { nomeUsuario: string }) {
  const caminho = usePathname();
  const [aberto, setAberto] = useState(false);

  const links = (
    <nav className="flex flex-col gap-1">
      {ITENS.map((item) => {
        const ativo = caminho === item.href || caminho.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={() => setAberto(false)}
            aria-current={ativo ? "page" : undefined}
            className={`rounded-lg px-3 py-2.5 text-sm font-medium transition ${
              ativo ? "bg-destaque/15 text-destaque" : "text-texto-secundario hover:bg-fundo hover:text-texto"
            }`}
          >
            {item.rotulo}
          </Link>
        );
      })}
    </nav>
  );

  const rodape = (
    <form action={sair} className="flex flex-col gap-2 border-t border-borda pt-4 text-sm">
      <span className="truncate text-texto-secundario">{nomeUsuario}</span>
      <button type="submit" className="self-start text-texto-secundario hover:text-destaque">
        Sair
      </button>
    </form>
  );

  return (
    <>
      {/* Celular */}
      <header className="sticky top-0 z-20 flex items-center justify-between border-b border-borda bg-fundo/95 px-4 py-3 backdrop-blur md:hidden">
        <Link href="/inicio">
          <Logo tamanho={26} />
        </Link>
        <button
          type="button"
          onClick={() => setAberto((v) => !v)}
          aria-expanded={aberto}
          aria-controls="menu-celular"
          className="rounded-lg border border-borda px-3 py-1.5 text-sm"
        >
          {aberto ? "Fechar" : "Menu"}
        </button>
      </header>
      {aberto && (
        <div id="menu-celular" className="flex flex-col gap-4 border-b border-borda bg-superficie p-4 md:hidden">
          {links}
          {rodape}
        </div>
      )}

      {/* Computador */}
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col gap-8 border-r border-borda bg-superficie p-5 md:flex">
        <Link href="/inicio">
          <Logo tamanho={28} />
        </Link>
        <div className="flex-1">{links}</div>
        {rodape}
      </aside>
    </>
  );
}
