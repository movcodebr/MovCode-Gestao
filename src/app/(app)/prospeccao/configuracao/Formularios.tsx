"use client";

import { useActionState } from "react";
import { Botao, Campo, Mensagem } from "@/components/ui";
import { importarPainelAntigo, salvarConfiguracao } from "../acoes";

type Valores = { cidades: string; nichos: string; leads_por_dia: string; assinatura: string; instrucoes: string };

const CLASSE_TEXTO =
  "w-full min-w-0 resize-y rounded-lg border border-borda bg-superficie px-3 py-2.5 text-base text-texto outline-none focus:border-destaque";

function AreaTexto({ rotulo, nome, valor, erro, linhas }: { rotulo: string; nome: string; valor: string; erro?: string; linhas: number }) {
  return (
    <label htmlFor={nome} className="flex min-w-0 flex-col gap-1.5 text-sm">
      <span className="text-texto-secundario">{rotulo}</span>
      <textarea id={nome} name={nome} defaultValue={valor} rows={linhas} aria-invalid={erro ? true : undefined} className={CLASSE_TEXTO} />
      {erro && <span className="text-perigo">{erro}</span>}
    </label>
  );
}

export function FormularioConfiguracao({ inicial }: { inicial: Valores }) {
  const [estado, enviar, enviando] = useActionState(salvarConfiguracao, {});
  const valor = (campo: keyof Valores) => estado.valores?.[campo] ?? inicial[campo];
  return (
    <form action={enviar} className="flex max-w-4xl flex-col gap-4">
      {estado.erro && <Mensagem tipo="erro">{estado.erro}</Mensagem>}
      {estado.sucesso && <Mensagem tipo="sucesso">{estado.sucesso}</Mensagem>}
      <div className="grid gap-4 sm:grid-cols-2">
        <AreaTexto rotulo="Cidades (uma por linha)" nome="cidades" valor={valor("cidades")} erro={estado.campos?.cidades} linhas={4} />
        <AreaTexto rotulo="Nichos (um por linha)" nome="nichos" valor={valor("nichos")} erro={estado.campos?.nichos} linhas={4} />
        <Campo
          rotulo="Leads novos por dia"
          name="leads_por_dia"
          type="number"
          min={1}
          max={30}
          defaultValue={valor("leads_por_dia")}
          erro={estado.campos?.leads_por_dia}
          required
        />
        <Campo
          rotulo="Assinatura das mensagens"
          name="assinatura"
          placeholder="Kaique, da MovCode"
          defaultValue={valor("assinatura")}
          erro={estado.campos?.assinatura}
        />
      </div>
      <AreaTexto
        rotulo="Instruções para a busca e as mensagens"
        nome="instrucoes"
        valor={valor("instrucoes")}
        erro={estado.campos?.instrucoes}
        linhas={10}
      />
      <div>
        <Botao type="submit" disabled={enviando}>
          {enviando ? "Salvando..." : "Salvar configuração"}
        </Botao>
      </div>
    </form>
  );
}

export function ImportarPainel() {
  const [estado, enviar, enviando] = useActionState(importarPainelAntigo, {});
  return (
    <form action={enviar} className="flex flex-col gap-3">
      {estado.erro && <Mensagem tipo="erro">{estado.erro}</Mensagem>}
      {estado.sucesso && <Mensagem tipo="sucesso">{estado.sucesso}</Mensagem>}
      <Campo rotulo="Arquivo exportado (.json)" name="arquivo" type="file" accept=".json,application/json" required />
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="configuracao" defaultChecked className="size-4 accent-[var(--destaque)]" />
        Trazer também a configuração da busca (substitui a desta tela)
      </label>
      <div>
        <Botao type="submit" variante="secundario" disabled={enviando}>
          {enviando ? "Importando..." : "Importar leads"}
        </Botao>
      </div>
    </form>
  );
}
