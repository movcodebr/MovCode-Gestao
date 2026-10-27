import { Menu } from "@/components/Menu";
import { usuarioAtual } from "@/lib/auth";

/** Layout das telas internas: exige login em toda página. */
export default async function LayoutApp({ children }: LayoutProps<"/">) {
  const usuario = await usuarioAtual();
  return (
    <div className="flex flex-1 flex-col md:flex-row">
      <Menu nomeUsuario={usuario.nome} />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 md:px-8 md:py-10">{children}</main>
    </div>
  );
}
