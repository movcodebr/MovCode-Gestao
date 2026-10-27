import { formatarData } from "@/lib/dominio/datas";
import { Etiqueta } from "./ui";

type Props = { ativo: boolean; emAtraso: boolean; pausadoAte: string | null };

/** Etiquetas de status, situação da mensalidade e lembretes pausados. */
export function SituacaoCliente({ ativo, emAtraso, pausadoAte }: Props) {
  return (
    <span className="inline-flex flex-wrap gap-1.5">
      {!ativo && <Etiqueta cor="cinza">Inativo</Etiqueta>}
      {emAtraso ? <Etiqueta cor="vermelho">Em atraso</Etiqueta> : <Etiqueta cor="verde">Paga</Etiqueta>}
      {pausadoAte && (
        <Etiqueta cor="amarelo">
          <span aria-hidden="true">⏸︎&nbsp;</span>Lembretes pausados até {formatarData(pausadoAte)}
        </Etiqueta>
      )}
    </span>
  );
}
