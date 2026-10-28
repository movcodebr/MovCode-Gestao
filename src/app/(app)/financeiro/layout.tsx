import { Abas } from "@/components/Abas";

const ABAS = [
  { href: "/financeiro", rotulo: "Dashboard", exato: true },
  { href: "/financeiro/lancamentos", rotulo: "Lançamentos" },
  { href: "/financeiro/vendas/nova", rotulo: "Lançar venda" },
  { href: "/financeiro/gastos/novo", rotulo: "Lançar gasto" },
  { href: "/financeiro/gastos/recorrentes", rotulo: "Gastos recorrentes" },
  { href: "/financeiro/reajustes", rotulo: "Reajustes IPCA" },
];

export default function LayoutFinanceiro({ children }: LayoutProps<"/financeiro">) {
  return (
    <>
      <Abas abas={ABAS} />
      {children}
    </>
  );
}
