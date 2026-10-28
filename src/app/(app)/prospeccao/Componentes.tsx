import Link from "next/link";
import { Etiqueta } from "@/components/ui";
import { type LeadResumo, nomeDoResponsavel } from "@/lib/consultas/prospeccao";
import { formatarData, hojeEmBrasilia } from "@/lib/dominio/datas";
import { ETAPAS, ETAPAS_FUNIL, type Etapa, faixaDaNota, followupVencido, LISTA_ETAPAS } from "@/lib/dominio/prospeccao";

const COR_ETAPA: Record<Etapa, "laranja" | "cinza" | "amarelo" | "verde"> = {
  novo: "laranja",
  abordado: "cinza",
  respondeu: "amarelo",
  reuniao: "amarelo",
  proposta: "amarelo",
  fechado: "verde",
  perdido: "cinza",
};

const COR_NOTA = {
  alta: "bg-sucesso/15 text-sucesso",
  media: "bg-alerta/15 text-alerta",
  baixa: "bg-borda text-texto-secundario",
};

/** Data de um momento (timestamp) no fuso de Brasília: "13/10/2026". */
export function dataDoMomento(momento: string): string {
  return formatarData(hojeEmBrasilia(new Date(momento)));
}

export function EtiquetaEtapa({ etapa }: { etapa: Etapa }) {
  return <Etiqueta cor={COR_ETAPA[etapa]}>{ETAPAS[etapa]}</Etiqueta>;
}

export function NotaLead({ nota, grande = false }: { nota: number; grande?: boolean }) {
  return (
    <span
      title="Nota do lead (0 a 100)"
      className={`grid shrink-0 place-items-center rounded-xl font-semibold tabular-nums ${COR_NOTA[faixaDaNota(nota)]} ${
        grande ? "size-14 text-lg" : "size-11"
      }`}
    >
      {nota}
    </span>
  );
}

/** Quantos leads em cada etapa; cada etapa abre a lista filtrada. */
export function Funil({ contagem }: { contagem: Partial<Record<Etapa, number>> }) {
  return (
    <nav
      aria-label="Funil de prospecção"
      className="mb-8 grid grid-cols-3 gap-px overflow-hidden rounded-2xl border border-borda bg-borda sm:grid-cols-4 lg:grid-cols-7"
    >
      {LISTA_ETAPAS.map((etapa) => (
        <Link
          key={etapa}
          href={`/prospeccao/pipeline?etapa=${etapa}`}
          className="flex flex-col gap-0.5 bg-superficie px-3 py-3 hover:bg-fundo"
        >
          <span className="text-2xl font-semibold tabular-nums">{contagem[etapa] ?? 0}</span>
          <span className="text-xs text-texto-secundario">{ETAPAS_FUNIL[etapa]}</span>
        </Link>
      ))}
    </nav>
  );
}

type PropsLista = {
  leads: LeadResumo[];
  usuarioId: string;
  nomes: Record<string, string>;
  agora: Date;
  vazio: { titulo: string; texto: string };
};

export function ListaLeads({ leads, usuarioId, nomes, agora, vazio }: PropsLista) {
  if (leads.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-borda px-4 py-8 text-center text-texto-secundario">
        <p className="font-medium text-texto">{vazio.titulo}</p>
        <p className="text-sm">{vazio.texto}</p>
      </div>
    );
  }
  return (
    <ul className="divide-y divide-borda overflow-hidden rounded-2xl border border-borda">
      {leads.map((l) => {
        const responsavel = nomeDoResponsavel(l.responsavel_id, usuarioId, nomes);
        return (
          <li key={l.id}>
            <Link
              href={`/prospeccao/${l.id}`}
              className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 hover:bg-superficie sm:flex-nowrap"
            >
              <NotaLead nota={l.nota} />
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{l.nome}</p>
                <p className="truncate text-sm text-texto-secundario">
                  @{l.instagram} · {l.nicho || "sem nicho"} · {l.site_situacao || "site não verificado"}
                </p>
              </div>
              <span className="flex flex-wrap gap-1.5 sm:justify-end">
                {responsavel && <Etiqueta cor="cinza">{responsavel}</Etiqueta>}
                {l.etapa === "abordado" &&
                  l.proximo_followup &&
                  (followupVencido({ etapa: l.etapa, proximoFollowup: l.proximo_followup }, agora) ? (
                    <Etiqueta cor="vermelho">cobrar hoje</Etiqueta>
                  ) : (
                    <Etiqueta cor="cinza">follow-up {dataDoMomento(l.proximo_followup)}</Etiqueta>
                  ))}
                <EtiquetaEtapa etapa={l.etapa} />
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
