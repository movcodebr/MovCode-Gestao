"use client";

import { useRef, useState, useTransition } from "react";
import { Botao, classesBotao, Mensagem, Selecao } from "@/components/ui";
import { type AcaoLead, ETAPAS, type Etapa } from "@/lib/dominio/prospeccao";
import {
  definirResponsavel,
  marcarPerfilConferido,
  mudarEtapaLead,
  registrarAcao,
  type Resultado,
  salvarNota,
  salvarTexto,
} from "../acoes";

/** Salva sozinho (sem botão "Salvar") e mostra "Salvando..." / "Salvo" / o erro. */
function useSalvar() {
  const [salvando, iniciar] = useTransition();
  const [estado, setEstado] = useState<{ erro?: string; salvo?: boolean }>({});
  function salvar(acao: () => Promise<Resultado>) {
    iniciar(async () => {
      const r = await acao();
      setEstado(r.erro ? { erro: r.erro } : { salvo: true });
    });
  }
  const aviso = salvando ? "Salvando..." : estado.salvo ? "Salvo" : "";
  return { salvar, salvando, erro: estado.erro, aviso };
}

const CLASSE_TEXTO =
  "w-full min-w-0 resize-y rounded-lg border border-borda bg-fundo px-3 py-2.5 text-base leading-relaxed text-texto outline-none focus:border-destaque";

type PropsMensagem = {
  leadId: string;
  campo: string;
  rotulo: string;
  texto: string;
  urlInstagram: string;
  perfilConferido: boolean;
  acoes: { acao: AcaoLead; rotulo: string }[];
};

/** O texto da vez (abertura, follow-up ou resposta), para copiar e colar na DM, e as ações do dia. */
export function PainelMensagem({ leadId, campo, rotulo, texto, urlInstagram, perfilConferido, acoes }: PropsMensagem) {
  // Separados: salvar o texto ao sair do campo não pode desabilitar o botão que está sendo clicado
  const { salvar, erro, aviso } = useSalvar();
  const passo = useSalvar();
  const caixa = useRef<HTMLTextAreaElement>(null);
  const salvo = useRef(texto);
  const [copiado, setCopiado] = useState(false);

  async function copiar() {
    try {
      await navigator.clipboard.writeText(caixa.current?.value ?? "");
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      caixa.current?.select();
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between gap-2">
        <label htmlFor="texto-da-vez" className="text-sm text-texto-secundario">
          {rotulo}
        </label>
        <span className="text-xs text-texto-secundario">{aviso}</span>
      </div>
      <textarea
        id="texto-da-vez"
        ref={caixa}
        defaultValue={texto}
        rows={8}
        maxLength={5000}
        className={CLASSE_TEXTO}
        onBlur={(e) => {
          const valor = e.target.value;
          if (valor === salvo.current) return;
          salvo.current = valor;
          salvar(() => salvarTexto(leadId, campo, valor));
        }}
      />
      {erro && <Mensagem tipo="erro">{erro}</Mensagem>}
      {passo.erro && <Mensagem tipo="erro">{passo.erro}</Mensagem>}
      <div className="flex flex-wrap gap-2">
        <Botao type="button" variante="secundario" onClick={copiar}>
          {copiado ? "Copiado!" : "Copiar"}
        </Botao>
        <a
          href={urlInstagram}
          target="_blank"
          rel="noopener noreferrer"
          className={classesBotao("secundario")}
          onClick={() => {
            if (!perfilConferido) salvar(() => marcarPerfilConferido(leadId, true));
          }}
        >
          Abrir Instagram ↗
        </a>
        {acoes.map((a, i) => (
          <Botao
            key={a.acao}
            type="button"
            variante={i === 0 ? "primario" : "secundario"}
            disabled={passo.salvando}
            onClick={() => passo.salvar(() => registrarAcao(leadId, a.acao))}
          >
            {a.rotulo}
          </Botao>
        ))}
      </div>
    </div>
  );
}

type PropsCampos = { leadId: string; etapa: Etapa; nota: number; perfilConferido: boolean };

/** Etapa, nota e "conferi o perfil": salvam assim que mudam. */
export function CamposLead({ leadId, etapa, nota, perfilConferido }: PropsCampos) {
  const { salvar, erro, aviso } = useSalvar();
  return (
    <div className="flex flex-col gap-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <Selecao
          rotulo="Etapa"
          name="etapa"
          defaultValue={etapa}
          onChange={(e) => {
            const nova = e.target.value as Etapa;
            salvar(() => mudarEtapaLead(leadId, nova));
          }}
        >
          {Object.entries(ETAPAS).map(([valor, rotulo]) => (
            <option key={valor} value={valor}>
              {rotulo}
            </option>
          ))}
        </Selecao>
        <label htmlFor="nota" className="flex min-w-0 flex-col gap-1.5 text-sm">
          <span className="text-texto-secundario">Nota (0 a 100)</span>
          <input
            id="nota"
            type="number"
            min={0}
            max={100}
            defaultValue={nota}
            className="w-full min-w-0 rounded-lg border border-borda bg-superficie px-3 py-2.5 text-base text-texto outline-none focus:border-destaque"
            onBlur={(e) => {
              const valor = Math.round(Number(e.target.value));
              if (e.target.value !== "" && valor !== nota) salvar(() => salvarNota(leadId, valor));
            }}
          />
        </label>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          defaultChecked={perfilConferido}
          className="size-4 accent-[var(--destaque)]"
          onChange={(e) => {
            const marcado = e.target.checked;
            salvar(() => marcarPerfilConferido(leadId, marcado));
          }}
        />
        Conferi o perfil (está ativo e a mensagem bate com o negócio)
      </label>
      {aviso && <span className="text-xs text-texto-secundario">{aviso}</span>}
      {erro && <Mensagem tipo="erro">{erro}</Mensagem>}
    </div>
  );
}

/** Anotações livres sobre a conversa: salvam ao sair do campo. */
export function Anotacoes({ leadId, notas }: { leadId: string; notas: string }) {
  const { salvar, erro, aviso } = useSalvar();
  const salvo = useRef(notas);
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <label htmlFor="notas" className="text-sm text-texto-secundario">
          Anotações
        </label>
        <span className="text-xs text-texto-secundario">{aviso}</span>
      </div>
      <textarea
        id="notas"
        defaultValue={notas}
        rows={4}
        maxLength={5000}
        placeholder="O que ele respondeu, objeções, próximo passo..."
        className={CLASSE_TEXTO}
        onBlur={(e) => {
          const valor = e.target.value;
          if (valor === salvo.current) return;
          salvo.current = valor;
          salvar(() => salvarTexto(leadId, "notas", valor));
        }}
      />
      {erro && <Mensagem tipo="erro">{erro}</Mensagem>}
    </div>
  );
}

type PropsResponsavel = { leadId: string; nome: string; meu: boolean; livre: boolean };

/** Quem cuida do lead, para os dois sócios não mandarem mensagem para o mesmo negócio. */
export function Responsavel({ leadId, nome, meu, livre }: PropsResponsavel) {
  const { salvar, salvando, erro } = useSalvar();
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-borda px-4 py-3">
        <div>
          <p className="text-xs text-texto-secundario">Responsável</p>
          <p className="font-medium">{livre ? "ninguém ainda" : nome}</p>
        </div>
        <Botao
          type="button"
          variante="secundario"
          className="px-3! py-1.5! text-xs!"
          disabled={salvando}
          onClick={() => salvar(() => definirResponsavel(leadId, !meu))}
        >
          {meu ? "Liberar" : livre ? "Assumir este lead" : "Assumir no lugar"}
        </Botao>
      </div>
      {!livre && !meu && (
        <Mensagem tipo="info">
          Este lead é de {nome}. Combinem antes de abordar, para não mandarem mensagem duas vezes.
        </Mensagem>
      )}
      {erro && <Mensagem tipo="erro">{erro}</Mensagem>}
    </div>
  );
}
