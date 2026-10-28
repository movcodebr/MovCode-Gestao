"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export type Aba = { href: string; rotulo: string; exato?: boolean };

/** Abas de uma seção (Financeiro, Prospecção), logo abaixo do título. */
export function Abas({ abas }: { abas: Aba[] }) {
  const caminho = usePathname();
  return (
    <nav className="-mx-4 mb-6 flex gap-1 overflow-x-auto border-b border-borda px-4 md:mx-0 md:px-0">
      {abas.map((aba) => {
        const ativa = aba.exato ? caminho === aba.href : caminho.startsWith(aba.href);
        return (
          <Link
            key={aba.href}
            href={aba.href}
            aria-current={ativa ? "page" : undefined}
            className={`whitespace-nowrap border-b-2 px-3 py-2.5 text-sm font-medium transition ${
              ativa ? "border-destaque text-destaque" : "border-transparent text-texto-secundario hover:text-texto"
            }`}
          >
            {aba.rotulo}
          </Link>
        );
      })}
    </nav>
  );
}
