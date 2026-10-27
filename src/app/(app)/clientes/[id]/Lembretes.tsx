import { ConfirmarAcao } from "@/components/ConfirmarAcao";
import { Cartao, Etiqueta } from "@/components/ui";
import type { EnvioHistorico, PausaHistorico } from "@/lib/consultas/lembretes";
import { formatarData, somarDias } from "@/lib/dominio/datas";
import { pausarLembretes, retomarLembretes } from "../acoes";
import { PausarLembretes } from "./PausarLembretes";

type Props = { clienteId: string; ativo: boolean; hoje: string; pausas: PausaHistorico[]; envios: EnvioHistorico[] };

const CANAIS: Record<string, string> = { email: "E-mail", whatsapp: "WhatsApp" };

function descricaoPausa(p: PausaHistorico, hoje: string): string {
  const base = `Pausado por ${p.pausadoPor} em ${formatarData(p.inicio)} até ${formatarData(p.fim)}`;
  const motivo = p.motivo ? ` — "${p.motivo}"` : "";
  if (p.retomadoEm) return `${base}${motivo}. Retomado por ${p.retomadoPor ?? "usuário"} em ${formatarData(p.retomadoEm)}.`;
  if (p.fim <= hoje) return `${base}${motivo}. Voltou automaticamente em ${formatarData(p.fim)}.`;
  return `${base}${motivo}.`;
}

/** Lembretes do cliente: pausar/retomar, histórico de pausas e de envios. */
export function Lembretes({ clienteId, ativo, hoje, pausas, envios }: Props) {
  const vigente = pausas.find((p) => p.vigente);
  return (
    <Cartao className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-semibold">Lembretes de cobrança</h2>
        {vigente ? (
          <Etiqueta cor="amarelo">Pausados até {formatarData(vigente.fim)}</Etiqueta>
        ) : ativo ? (
          <Etiqueta cor="verde">Ativos</Etiqueta>
        ) : (
          <Etiqueta cor="cinza">Cliente inativo: sem lembretes</Etiqueta>
        )}
      </div>

      {vigente ? (
        <div className="flex flex-col items-start gap-3">
          {vigente.motivo && <p className="text-sm">Motivo: {vigente.motivo}</p>}
          <ConfirmarAcao
            rotulo="Retomar lembretes"
            titulo="Retomar os lembretes agora?"
            mensagem="Os lembretes voltam a partir do próximo dia do calendário (a cada 3 dias desde o vencimento, até 30 dias). Os que cairiam durante a pausa não são reenviados."
            rotuloConfirmar="Retomar"
            acao={retomarLembretes.bind(null, clienteId)}
          />
        </div>
      ) : (
        ativo && (
          <div>
            <PausarLembretes acao={pausarLembretes.bind(null, clienteId)} amanha={somarDias(hoje, 1)} />
          </div>
        )
      )}

      {pausas.length > 0 && (
        <details className="text-sm">
          <summary className="cursor-pointer text-texto-secundario hover:text-texto">Histórico de pausas ({pausas.length})</summary>
          <ul className="mt-2 flex flex-col gap-1.5">
            {pausas.map((p) => (
              <li key={p.id}>{descricaoPausa(p, hoje)}</li>
            ))}
          </ul>
        </details>
      )}

      <div className="text-sm">
        <h3 className="mb-2 text-texto-secundario">Lembretes enviados</h3>
        {envios.length === 0 ? (
          <p className="text-texto-secundario">Nenhum lembrete enviado ainda.</p>
        ) : (
          <ul className="flex max-h-64 flex-col divide-y divide-borda overflow-y-auto">
            {envios.map((e) => (
              <li key={`${e.data}-${e.canal}`} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <span>
                  {formatarData(e.data)} · {CANAIS[e.canal] ?? e.canal} · {e.cobrancas} cobrança(s)
                  {e.maiorAtraso === 0
                    ? " · dia do vencimento"
                    : ` · ${e.cobrancas > 1 ? "até " : ""}${e.maiorAtraso} dias de atraso`}
                  {e.modo === "log" && <span className="text-texto-secundario"> · modo teste (não enviado)</span>}
                </span>
                {e.sucesso ? (
                  e.modo === "log" ? <Etiqueta cor="cinza">Registrado</Etiqueta> : <Etiqueta cor="verde">Enviado</Etiqueta>
                ) : (
                  <span className="flex items-center gap-2">
                    <span className="max-w-64 truncate text-xs text-perigo" title={e.erro ?? ""}>
                      {e.erro}
                    </span>
                    <Etiqueta cor="vermelho">Falhou</Etiqueta>
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </Cartao>
  );
}
