import { STATUS_LANCAMENTO, type StatusLancamento as Status } from "@/lib/dominio/lancamentos";
import { Etiqueta } from "./ui";

const CORES = { pago: "verde", pendente: "cinza", atrasado: "vermelho" } as const;

export function StatusLancamento({ status }: { status: Status }) {
  return <Etiqueta cor={CORES[status]}>{STATUS_LANCAMENTO[status]}</Etiqueta>;
}
