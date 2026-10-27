import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ConfirmarAcao } from "@/components/ConfirmarAcao";
import { Cartao, Mensagem, TituloPagina } from "@/components/ui";
import { formatarData } from "@/lib/dominio/datas";
import { formatarValorCampo } from "@/lib/dominio/dinheiro";
import { criarClienteSupabase } from "@/lib/supabase/servidor";
import { encerrarGastoRecorrente, salvarGastoRecorrente } from "../../../acoes";
import { FormularioRecorrente } from "./FormularioRecorrente";

export const metadata: Metadata = { title: "Gasto recorrente — Mov Code" };

export default async function PaginaGastoRecorrente({ params }: PageProps<"/financeiro/gastos/recorrentes/[id]">) {
  const { id } = await params;
  const supabase = await criarClienteSupabase();
  const { data: g } = await supabase.from("gastos_recorrentes").select("*").eq("id", id).maybeSingle();
  if (!g) notFound();

  return (
    <>
      <TituloPagina descricao={`Todo dia ${g.dia_vencimento}, desde ${formatarData(g.data_inicio)}.`}>{g.descricao}</TituloPagina>
      {g.encerrado_em ? (
        <Mensagem tipo="info">Recorrência encerrada em {formatarData(g.encerrado_em)}. Nenhum gasto novo será gerado.</Mensagem>
      ) : (
        <div className="flex flex-col gap-8">
          <FormularioRecorrente
            acao={salvarGastoRecorrente.bind(null, g.id)}
            inicial={{
              descricao: g.descricao,
              categoria: g.categoria,
              valor: formatarValorCampo(g.valor_centavos),
              forma_pagamento: g.forma_pagamento,
              data_fim: g.data_fim ?? "",
            }}
          />
          <Cartao className="flex max-w-2xl flex-col items-start gap-3">
            <h2 className="font-semibold">Encerrar recorrência</h2>
            <p className="text-sm text-texto-secundario">
              Para de gerar este gasto a partir de hoje. Os gastos já lançados continuam no histórico.
            </p>
            <ConfirmarAcao
              rotulo="Encerrar recorrência"
              titulo="Encerrar esta recorrência?"
              mensagem="Nenhum gasto novo será gerado a partir de hoje."
              rotuloConfirmar="Encerrar"
              variante="perigo"
              acao={encerrarGastoRecorrente.bind(null, g.id)}
            />
          </Cartao>
        </div>
      )}
    </>
  );
}
