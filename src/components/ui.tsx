import Link from "next/link";
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from "react";

type Variante = "primario" | "secundario" | "perigo";

const estilosBotao: Record<Variante, string> = {
  primario: "bg-destaque text-texto-sobre-destaque hover:bg-destaque-hover",
  secundario: "border border-borda text-texto hover:bg-superficie",
  perigo: "bg-perigo text-white hover:opacity-90",
};

export function Botao({
  variante = "primario",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variante?: Variante }) {
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 ${estilosBotao[variante]} ${className}`}
      {...props}
    />
  );
}

export function Campo({
  rotulo,
  erro,
  id,
  className = "",
  ajuda,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { rotulo: string; erro?: string; ajuda?: string }) {
  const campoId = id ?? props.name;
  return (
    <label htmlFor={campoId} className="flex min-w-0 flex-col gap-1.5 text-sm">
      <span className="text-texto-secundario">{rotulo}</span>
      <input
        id={campoId}
        aria-invalid={erro ? true : undefined}
        className={`w-full min-w-0 rounded-lg border border-borda bg-superficie px-3 py-2.5 text-base text-texto outline-none focus:border-destaque ${className}`}
        {...props}
      />
      {ajuda && <span className="text-xs text-texto-secundario">{ajuda}</span>}
      {erro && <span className="text-perigo">{erro}</span>}
    </label>
  );
}

export function Mensagem({ tipo, children }: { tipo: "erro" | "sucesso" | "info"; children: ReactNode }) {
  const cores = {
    erro: "border-perigo/40 bg-perigo/10 text-perigo",
    sucesso: "border-sucesso/40 bg-sucesso/10 text-sucesso",
    info: "border-borda bg-superficie text-texto-secundario",
  };
  return (
    <p role={tipo === "erro" ? "alert" : "status"} className={`rounded-lg border px-3 py-2 text-sm ${cores[tipo]}`}>
      {children}
    </p>
  );
}

export function Cartao({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-2xl border border-borda bg-superficie p-5 ${className}`}>{children}</div>;
}

export function TituloPagina({ children, descricao }: { children: ReactNode; descricao?: string }) {
  return (
    <header className="mb-6">
      <h1 className="font-titulo text-3xl uppercase tracking-wide sm:text-4xl">{children}</h1>
      {descricao && <p className="mt-1 text-texto-secundario">{descricao}</p>}
    </header>
  );
}

export function Selecao({
  rotulo,
  erro,
  id,
  children,
  ajuda,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & { rotulo: string; erro?: string; ajuda?: string }) {
  const campoId = id ?? props.name;
  return (
    <label htmlFor={campoId} className="flex min-w-0 flex-col gap-1.5 text-sm">
      <span className="text-texto-secundario">{rotulo}</span>
      <select
        id={campoId}
        aria-invalid={erro ? true : undefined}
        className="rounded-lg border border-borda bg-superficie px-3 py-2.5 text-base text-texto outline-none focus:border-destaque"
        {...props}
      >
        {children}
      </select>
      {ajuda && <span className="text-xs text-texto-secundario">{ajuda}</span>}
      {erro && <span className="text-perigo">{erro}</span>}
    </label>
  );
}

export function Etiqueta({ cor, children }: { cor: "verde" | "vermelho" | "cinza" | "amarelo"; children: ReactNode }) {
  const cores = {
    verde: "bg-sucesso/15 text-sucesso",
    vermelho: "bg-perigo/15 text-perigo",
    amarelo: "bg-alerta/15 text-alerta",
    cinza: "bg-borda text-texto-secundario",
  };
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${cores[cor]}`}>
      {children}
    </span>
  );
}

export function LinkBotao({
  href,
  children,
  variante = "primario",
}: {
  href: string;
  children: ReactNode;
  variante?: Variante;
}) {
  return (
    <Link
      href={href}
      className={`inline-flex items-center justify-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold transition ${estilosBotao[variante]}`}
    >
      {children}
    </Link>
  );
}
