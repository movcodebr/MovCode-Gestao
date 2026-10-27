import { Logo } from "@/components/Logo";

// Página provisória da Fase 0; a tela de Início com login chega na Fase 1.
export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 px-4 text-center">
      <Logo tamanho={64} />
      <h1 className="font-titulo text-4xl uppercase sm:text-6xl">
        Tecnologia do <span className="text-destaque">tamanho</span> do seu negócio.
      </h1>
      <p className="text-texto-secundario">Sistema de gestão em construção.</p>
    </main>
  );
}
