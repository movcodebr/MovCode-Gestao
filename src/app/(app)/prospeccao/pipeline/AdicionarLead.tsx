"use client";

import { useActionState } from "react";
import { Botao, Campo, Mensagem } from "@/components/ui";
import { adicionarLead } from "../acoes";

export function AdicionarLead() {
  const [estado, enviar, enviando] = useActionState(adicionarLead, {});
  return (
    <form action={enviar} className="flex flex-col gap-3 rounded-2xl border border-borda bg-superficie p-4">
      {estado.erro && <Mensagem tipo="erro">{estado.erro}</Mensagem>}
      <div className="grid gap-3 sm:grid-cols-[1fr_1fr_1fr_auto] sm:items-end">
        <Campo
          rotulo="@ do Instagram"
          name="instagram"
          placeholder="@negocio"
          autoCapitalize="none"
          defaultValue={estado.valores?.instagram}
          erro={estado.campos?.instagram}
          required
        />
        <Campo
          rotulo="Nome do negócio"
          name="nome"
          defaultValue={estado.valores?.nome}
          erro={estado.campos?.nome}
          required
        />
        <Campo
          rotulo="Nicho"
          name="nicho"
          placeholder="ex.: pet shop"
          defaultValue={estado.valores?.nicho}
          erro={estado.campos?.nicho}
        />
        <Botao type="submit" disabled={enviando}>
          {enviando ? "Adicionando..." : "Adicionar"}
        </Botao>
      </div>
    </form>
  );
}
