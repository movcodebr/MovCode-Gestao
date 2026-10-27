import { Logo } from "@/components/Logo";

/** Layout das telas sem login: logo centralizado e um cartão com o formulário. */
export default function LayoutPublico({ children }: LayoutProps<"/">) {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-8 px-4 py-10">
      <Logo tamanho={48} />
      <div className="w-full max-w-sm rounded-2xl border border-borda bg-superficie p-6">{children}</div>
    </main>
  );
}
