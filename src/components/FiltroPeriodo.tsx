import Link from "next/link";
import { deslocarPeriodo, nomeDoPeriodo, type TipoPeriodo } from "@/lib/dominio/datas";

type Props = {
  caminho: string;
  tipo: TipoPeriodo;
  referencia: string;
  /** Outros filtros que devem ser mantidos nos links */
  parametros?: Record<string, string>;
};

const TIPOS: Record<TipoPeriodo, string> = { mes: "Mês", trimestre: "Trimestre", ano: "Ano" };

/** Seletor de período (mês, trimestre, ano) com navegação para o anterior e o próximo. */
export function FiltroPeriodo({ caminho, tipo, referencia, parametros = {} }: Props) {
  const link = (t: TipoPeriodo, ref: string) =>
    `${caminho}?${new URLSearchParams({ ...parametros, periodo: t, ref }).toString()}`;

  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="flex rounded-full border border-borda p-1 text-sm">
        {(Object.keys(TIPOS) as TipoPeriodo[]).map((t) => (
          <Link
            key={t}
            href={link(t, referencia)}
            aria-current={t === tipo ? "true" : undefined}
            className={`rounded-full px-3 py-1 ${t === tipo ? "bg-destaque text-texto-sobre-destaque" : "text-texto-secundario hover:text-texto"}`}
          >
            {TIPOS[t]}
          </Link>
        ))}
      </div>
      <div className="flex items-center gap-1 text-sm">
        <Link
          href={link(tipo, deslocarPeriodo(tipo, referencia, -1))}
          aria-label="Período anterior"
          className="rounded-full px-2 py-1 text-texto-secundario hover:text-texto"
        >
          ‹
        </Link>
        <span className="min-w-36 text-center font-medium first-letter:uppercase">{nomeDoPeriodo(tipo, referencia)}</span>
        <Link
          href={link(tipo, deslocarPeriodo(tipo, referencia, 1))}
          aria-label="Próximo período"
          className="rounded-full px-2 py-1 text-texto-secundario hover:text-texto"
        >
          ›
        </Link>
      </div>
    </div>
  );
}
