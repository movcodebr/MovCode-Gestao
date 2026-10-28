import { Abas } from "@/components/Abas";

const ABAS = [
  { href: "/prospeccao", rotulo: "Hoje", exato: true },
  { href: "/prospeccao/pipeline", rotulo: "Pipeline" },
  { href: "/prospeccao/configuracao", rotulo: "Configuração" },
];

export default function LayoutProspeccao({ children }: LayoutProps<"/prospeccao">) {
  return (
    <>
      <Abas abas={ABAS} />
      {children}
    </>
  );
}
