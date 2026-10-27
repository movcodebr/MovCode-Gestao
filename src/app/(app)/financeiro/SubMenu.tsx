"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ABAS = [
  { href: "/financeiro", rotulo: "Dashboard", exato: true },
  { href: "/financeiro/lancamentos", rotulo: "Lançamentos" },
  { href: "/financeiro/vendas/nova", rotulo: "Lançar venda" },
  { href: "/financeiro/gastos/novo", rotulo: "Lançar gasto" },
  { href: "/financeiro/gastos/recorrentes", rotulo: "Gastos recorrentes" },
];

export function SubMenu() {
  const caminho = usePathname();
  return (
    <nav className="-mx-4 mb-6 flex gap-1 overflow-x-auto border-b border-borda px-4 md:mx-0 md:px-0">
      {ABAS.map((aba) => {
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
