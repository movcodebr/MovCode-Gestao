import { ConfirmarAcao } from "@/components/ConfirmarAcao";
import { Cartao, Etiqueta } from "@/components/ui";
import type { MensalidadeDoCliente } from "@/lib/consultas/mensalidades";
import { formatarData } from "@/lib/dominio/datas";
import { formatarReais } from "@/lib/dominio/dinheiro";
import { cancelarMensalidade } from "../acoes";

/** Mensalidades do cliente: valor atual, vencimento, reajuste, status e situação de pagamento. */
export function Mensalidades({ mensalidades, clienteId }: { mensalidades: MensalidadeDoCliente[]; clienteId: string }) {
  return (
    <Cartao className="flex flex-col gap-4">
      <h2 className="font-semibold">Mensalidades</h2>
      {mensalidades.length === 0 && <p className="text-sm text-texto-secundario">Nenhuma mensalidade contratada.</p>}
      <ul className="flex flex-col divide-y divide-borda">
        {mensalidades.map((m) => (
          <li key={m.id} className="flex flex-col gap-3 py-4 first:pt-0 last:pb-0">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium">{m.produto}</span>
                {m.status === "ativa" ? <Etiqueta cor="verde">Ativa</Etiqueta> : <Etiqueta cor="cinza">Cancelada</Etiqueta>}
                {m.emAtraso ? <Etiqueta cor="vermelho">Em atraso</Etiqueta> : <Etiqueta cor="verde">Paga</Etiqueta>}
              </div>
              <span className="font-semibold tabular-nums">{formatarReais(m.valorAtual)}/mês</span>
            </div>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-4">
              <div>
                <dt className="text-texto-secundario">Vencimento</dt>
                <dd>todo dia {m.dia}</dd>
              </div>
              <div>
                <dt className="text-texto-secundario">Início</dt>
                <dd>{formatarData(m.dataInicio)}</dd>
              </div>
              <div>
                <dt className="text-texto-secundario">Próximo reajuste</dt>
                <dd>{m.proximoReajuste ? formatarData(m.proximoReajuste) : "—"}</dd>
              </div>
              {m.canceladaEm && (
                <div>
                  <dt className="text-texto-secundario">Cancelada em</dt>
                  <dd>{formatarData(m.canceladaEm)}</dd>
                </div>
              )}
            </dl>
            {m.reajustes.length > 0 && (
              <details className="text-sm">
                <summary className="cursor-pointer text-texto-secundario hover:text-texto">Histórico de valores</summary>
                <ul className="mt-2 flex flex-col gap-1">
                  {m.reajustes.map((r) => (
                    <li key={r.aniversario}>
                      {formatarData(r.aplicadoEm)}: {formatarReais(r.anterior)} → {formatarReais(r.novo)} (IPCA{" "}
                      {Number(r.indice).toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%
                      {r.fonte === "manual" ? ", informado manualmente" : ""})
                    </li>
                  ))}
                </ul>
              </details>
            )}
            {m.status === "ativa" && (
              <div>
                <ConfirmarAcao
                  rotulo="Cancelar mensalidade"
                  titulo={`Cancelar a mensalidade de ${m.produto}?`}
                  mensagem="Ela para de gerar cobranças futuras e sai do MRR. O cliente e as outras mensalidades continuam ativos, e as cobranças já geradas ficam no histórico. Não é possível desfazer."
                  rotuloConfirmar="Cancelar mensalidade"
                  variante="perigo"
                  acao={cancelarMensalidade.bind(null, m.id, clienteId)}
                />
              </div>
            )}
          </li>
        ))}
      </ul>
    </Cartao>
  );
}
