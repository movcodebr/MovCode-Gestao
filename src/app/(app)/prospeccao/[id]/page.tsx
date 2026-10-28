import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ConfirmarAcao } from "@/components/ConfirmarAcao";
import { Cartao, LinkBotao, Mensagem } from "@/components/ui";
import { usuarioAtual } from "@/lib/auth";
import { andamentoDe, nomeDoResponsavel, nomesDosUsuarios } from "@/lib/consultas/prospeccao";
import { formatarTelefone, normalizarTelefone, telefoneValido } from "@/lib/dominio/documento";
import {
  ACOES,
  acoesDaVez,
  CAMPOS_TEXTO,
  type Etapa,
  semResposta,
  textoDaVez,
  urlInstagram,
} from "@/lib/dominio/prospeccao";
import { criarClienteSupabase } from "@/lib/supabase/servidor";
import { descartarLead } from "../acoes";
import { dataDoMomento, EtiquetaEtapa, NotaLead } from "../Componentes";
import { Anotacoes, CamposLead, PainelMensagem, Responsavel } from "./EdicaoLead";

export const metadata: Metadata = { title: "Lead — Prospecção — Mov Code" };

function Fato({ rotulo, children }: { rotulo: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-texto-secundario">{rotulo}</dt>
      <dd className="break-words">{children}</dd>
    </div>
  );
}

const LINK = "text-destaque underline-offset-2 hover:underline";

export default async function PaginaLead({ params }: PageProps<"/prospeccao/[id]">) {
  const usuario = await usuarioAtual();
  const { id } = await params;
  const supabase = await criarClienteSupabase();
  const [{ data: lead }, nomes] = await Promise.all([
    supabase.from("leads").select("*").eq("id", id).maybeSingle(),
    nomesDosUsuarios(supabase),
  ]);
  if (!lead) notFound();

  const agora = new Date();
  const andamento = andamentoDe(lead);
  const campo = textoDaVez(andamento, agora);
  const acoes = acoesDaVez(andamento, agora).map((acao) => ({ acao, rotulo: ACOES[acao] }));
  const telefone = normalizarTelefone(lead.whatsapp);
  const historico = [
    `Encontrado em ${dataDoMomento(lead.encontrado_em)}`,
    lead.fonte && `fonte: ${lead.fonte}`,
    lead.abordado_em && `abordado em ${dataDoMomento(lead.abordado_em)}`,
    lead.followups_enviados > 0 && `${lead.followups_enviados} follow-up(s) enviado(s)`,
    lead.etapa === "abordado" && lead.proximo_followup && `próximo follow-up em ${dataDoMomento(lead.proximo_followup)}`,
  ].filter(Boolean);

  return (
    <>
      <Link href="/prospeccao/pipeline" className="mb-4 inline-block text-sm text-texto-secundario hover:text-destaque">
        ← Pipeline
      </Link>
      <header className="mb-6 flex items-start gap-4">
        <NotaLead nota={lead.nota} grande />
        <div className="min-w-0 flex-1">
          <h1 className="font-titulo text-3xl uppercase tracking-wide break-words sm:text-4xl">{lead.nome}</h1>
          <p className="mt-1 flex flex-wrap items-center gap-2 text-texto-secundario">
            <span>
              @{lead.instagram}
              {lead.cidade && ` · ${lead.cidade}`}
            </span>
            <EtiquetaEtapa etapa={lead.etapa as Etapa} />
          </p>
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <div className="flex min-w-0 flex-col gap-6">
          <Cartao className="flex flex-col gap-4">
            {semResposta(andamento, agora) && (
              <Mensagem tipo="info">Já foram 2 follow-ups sem resposta. Vale mover para Perdido e seguir em frente.</Mensagem>
            )}
            {!lead.perfil_conferido && acoes.length > 0 && (
              <Mensagem tipo="info">
                Dê uma olhada no perfil antes de enviar: confira se está ativo e ajuste a mensagem se algo não bater.
              </Mensagem>
            )}
            <PainelMensagem
              key={campo}
              leadId={lead.id}
              campo={campo}
              rotulo={CAMPOS_TEXTO[campo]}
              texto={lead[campo]}
              urlInstagram={urlInstagram(lead.instagram)}
              perfilConferido={lead.perfil_conferido}
              acoes={acoes}
            />
          </Cartao>

          <Cartao className="flex flex-col gap-4">
            <h2 className="font-semibold">Andamento</h2>
            <Responsavel
              key={lead.responsavel_id ?? "livre"}
              leadId={lead.id}
              nome={nomeDoResponsavel(lead.responsavel_id, usuario.id, nomes)}
              meu={lead.responsavel_id === usuario.id}
              livre={!lead.responsavel_id}
            />
            <CamposLead
              key={`${lead.etapa}-${lead.nota}-${lead.perfil_conferido}`}
              leadId={lead.id}
              etapa={lead.etapa}
              nota={lead.nota}
              perfilConferido={lead.perfil_conferido}
            />
            <Anotacoes leadId={lead.id} notas={lead.notas} />
            <p className="text-sm text-texto-secundario">{historico.join(" · ")}</p>
          </Cartao>
        </div>

        <div className="flex min-w-0 flex-col gap-6">
          <Cartao>
            <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
              <Fato rotulo="Nicho">{lead.nicho || "—"}</Fato>
              <Fato rotulo="Site">
                {lead.site_url ? (
                  <a href={lead.site_url} target="_blank" rel="noopener noreferrer" className={LINK}>
                    {lead.site_situacao || "ver site"} ↗
                  </a>
                ) : (
                  lead.site_situacao || "—"
                )}
              </Fato>
              <Fato rotulo="Serviço sugerido">{lead.servico || "—"}</Fato>
              <Fato rotulo="WhatsApp">
                {telefoneValido(telefone) ? (
                  <a href={`https://wa.me/55${telefone}`} target="_blank" rel="noopener noreferrer" className={LINK}>
                    {formatarTelefone(telefone)} ↗
                  </a>
                ) : (
                  lead.whatsapp || "—"
                )}
              </Fato>
              {lead.link_previa && (
                <Fato rotulo="Prévia personalizada">
                  <a href={lead.link_previa} target="_blank" rel="noopener noreferrer" className={LINK}>
                    Abrir a prévia deste lead ↗
                  </a>
                </Fato>
              )}
              <Fato rotulo="Por que é um bom lead">{lead.motivo || "—"}</Fato>
              {lead.dor && <Fato rotulo="Dor provável">{lead.dor}</Fato>}
            </dl>
          </Cartao>

          <Cartao className="flex flex-col items-start gap-3">
            <h2 className="font-semibold">Virou cliente?</h2>
            {lead.cliente_id ? (
              <LinkBotao href={`/clientes/${lead.cliente_id}`} variante="secundario">
                Ver o cliente
              </LinkBotao>
            ) : (
              <>
                <p className="text-sm text-texto-secundario">
                  Cadastre o cliente a partir deste lead: o nome e o WhatsApp já vêm preenchidos e o lead vai para
                  Fechado.
                </p>
                <LinkBotao href={`/clientes/novo?lead=${lead.id}`} variante="secundario">
                  Cadastrar como cliente
                </LinkBotao>
              </>
            )}
          </Cartao>

          <div>
            <ConfirmarAcao
              rotulo="Descartar lead"
              titulo="Descartar este lead?"
              mensagem={`${lead.nome} (@${lead.instagram}) sai da lista. Como o @ deixa de existir no sistema, a busca diária pode trazê-lo de novo: para ele não voltar, mova para Perdido em vez de descartar.`}
              rotuloConfirmar="Descartar"
              variante="perigo"
              compacto
              acao={descartarLead.bind(null, lead.id)}
            />
          </div>
        </div>
      </div>
    </>
  );
}
