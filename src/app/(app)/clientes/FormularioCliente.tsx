"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { Botao, Campo, Mensagem, Selecao } from "@/components/ui";
import { NOME_TIPO, tipoDoDocumento } from "@/lib/dominio/documento";
import type { EstadoFormulario } from "@/lib/formulario";

type Valores = { nome: string; telefone: string; email: string; documento: string; status: string };

type Props = {
  acao: (estado: EstadoFormulario, dados: FormData) => Promise<EstadoFormulario>;
  inicial?: Valores;
  voltarPara: string;
  /** Lead da prospecção que virou este cliente (cadastro a partir do lead) */
  leadId?: string;
};

export function FormularioCliente({ acao, inicial, voltarPara, leadId }: Props) {
  const [estado, enviar, enviando] = useActionState(acao, {});
  const valor = (campo: keyof Valores) => estado.valores?.[campo] ?? inicial?.[campo];
  const [documento, setDocumento] = useState(valor("documento") ?? "");
  const tipo = tipoDoDocumento(documento);

  return (
    <form action={enviar} className="flex max-w-2xl flex-col gap-4">
      {estado.erro && <Mensagem tipo="erro">{estado.erro}</Mensagem>}
      {leadId && <input type="hidden" name="lead_id" value={leadId} />}
      <Campo rotulo="Nome" name="nome" defaultValue={valor("nome")} erro={estado.campos?.nome} required />
      <div className="grid gap-4 sm:grid-cols-2">
        <Campo
          rotulo="CPF ou CNPJ"
          name="documento"
          value={documento}
          onChange={(e) => setDocumento(e.target.value)}
          erro={estado.campos?.documento}
          ajuda={tipo ? `Tipo: ${NOME_TIPO[tipo]}` : "O tipo é definido automaticamente: CPF = Pessoa Física, CNPJ = Empresa."}
          required
        />
        <Selecao rotulo="Status" name="status" defaultValue={valor("status") ?? "ativo"} erro={estado.campos?.status}>
          <option value="ativo">Ativo</option>
          <option value="inativo">Inativo</option>
        </Selecao>
        <Campo
          rotulo="Telefone (com DDD, usado no WhatsApp)"
          name="telefone"
          type="tel"
          inputMode="tel"
          placeholder="(11) 98765-4321"
          defaultValue={valor("telefone")}
          erro={estado.campos?.telefone}
          required
        />
        <Campo
          rotulo="E-mail"
          name="email"
          type="email"
          defaultValue={valor("email")}
          erro={estado.campos?.email}
          required
        />
      </div>
      <p className="text-xs text-texto-secundario">
        Cliente inativo não gera cobranças novas de nenhuma mensalidade; as cobranças já existentes continuam no
        histórico.
      </p>
      <div className="flex gap-2">
        <Botao type="submit" disabled={enviando}>
          {enviando ? "Salvando..." : "Salvar"}
        </Botao>
        <Link href={voltarPara} className="px-4 py-2.5 text-sm text-texto-secundario hover:text-texto">
          Cancelar
        </Link>
      </div>
    </form>
  );
}
