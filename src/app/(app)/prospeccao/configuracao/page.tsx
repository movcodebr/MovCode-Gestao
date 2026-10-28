import type { Metadata } from "next";
import { Cartao, TituloPagina } from "@/components/ui";
import { urlDoSite } from "@/lib/env";
import { criarClienteSupabase } from "@/lib/supabase/servidor";
import { dataDoMomento } from "../Componentes";
import { FormularioConfiguracao, ImportarPainel } from "./Formularios";

export const metadata: Metadata = { title: "Configuração — Prospecção — Mov Code" };

export default async function PaginaConfiguracao() {
  const supabase = await criarClienteSupabase();
  const { data: config } = await supabase
    .from("prospeccao_config")
    .select("cidades, nichos, leads_por_dia, assinatura, instrucoes, ultima_busca_em, ultima_busca_adicionados")
    .single();
  const conectada = Boolean(process.env.PROSPECCAO_TOKEN);

  return (
    <>
      <TituloPagina descricao="A busca diária de leads lê isto toda manhã.">O que a busca procura</TituloPagina>
      {config && (
        <FormularioConfiguracao
          inicial={{
            cidades: config.cidades.join("\n"),
            nichos: config.nichos.join("\n"),
            leads_por_dia: String(config.leads_por_dia),
            assinatura: config.assinatura,
            instrucoes: config.instrucoes,
          }}
        />
      )}

      <section className="mt-10 grid gap-6 lg:grid-cols-2">
        <Cartao className="flex flex-col gap-2">
          <h2 className="font-semibold">Busca diária de leads</h2>
          <p className="text-sm text-texto-secundario">
            Uma tarefa agendada do Claude procura negócios no Instagram em dias úteis de manhã, escreve as mensagens e
            grava os leads novos aqui. Ninguém recebe mensagem automática: vocês enviam as DMs à mão.
          </p>
          <p className="text-sm">
            {config?.ultima_busca_em
              ? `Última busca: ${dataDoMomento(config.ultima_busca_em)}, ${config.ultima_busca_adicionados ?? 0} lead(s) novo(s).`
              : "A busca ainda não gravou nenhum lead neste sistema."}
          </p>
          <p className="text-sm text-texto-secundario">
            {conectada
              ? `Conexão ligada: a tarefa usa ${urlDoSite()}/api/prospeccao/rotina com o PROSPECCAO_TOKEN.`
              : "Conexão desligada: cadastre a variável PROSPECCAO_TOKEN na Vercel (README, seção Prospecção)."}
          </p>
        </Cartao>
        <Cartao className="flex flex-col gap-3">
          <h2 className="font-semibold">Trazer os leads do painel antigo</h2>
          <p className="text-sm text-texto-secundario">
            Envie o arquivo exportado do painel &quot;Prospecção MovCode&quot;. Leads que já estão aqui (mesmo @) não
            são alterados, então dá para importar de novo sem duplicar.
          </p>
          <ImportarPainel />
        </Cartao>
      </section>
    </>
  );
}
