"use client";

import { useActionState, useState } from "react";
import { Botao, Campo, Mensagem, Selecao } from "@/components/ui";
import { CATEGORIAS_GASTO, FORMAS_PAGAMENTO } from "@/lib/dominio/lancamentos";
import { registrarGasto } from "../../acoes";

export function FormularioGasto({ hoje }: { hoje: string }) {
  const [estado, enviar, enviando] = useActionState(registrarGasto, {});
  const v = estado.valores ?? {};
  const [recorrente, setRecorrente] = useState(v.recorrente === "sim");

  return (
    <form action={enviar} className="flex max-w-2xl flex-col gap-4">
      {estado.erro && <Mensagem tipo="erro">{estado.erro}</Mensagem>}
      <Campo rotulo="Descrição" name="descricao" defaultValue={v.descricao} erro={estado.campos?.descricao} required />
      <div className="grid gap-4 sm:grid-cols-2">
        <Selecao rotulo="Categoria" name="categoria" defaultValue={v.categoria ?? ""} erro={estado.campos?.categoria} required>
          <option value="" disabled>
            Escolha a categoria
          </option>
          {Object.entries(CATEGORIAS_GASTO).map(([valor, rotulo]) => (
            <option key={valor} value={valor}>
              {rotulo}
            </option>
          ))}
        </Selecao>
        <Campo
          rotulo="Valor, R$"
          name="valor"
          inputMode="decimal"
          placeholder="0,00"
          defaultValue={v.valor}
          erro={estado.campos?.valor}
          required
        />
        <Selecao rotulo="Forma de pagamento" name="forma_pagamento" defaultValue={v.forma_pagamento ?? "pix"}>
          {Object.entries(FORMAS_PAGAMENTO).map(([valor, rotulo]) => (
            <option key={valor} value={valor}>
              {rotulo}
            </option>
          ))}
        </Selecao>
        <Campo
          rotulo={recorrente ? "Primeiro vencimento" : "Vencimento"}
          name="vencimento"
          type="date"
          defaultValue={v.vencimento ?? hoje}
          erro={estado.campos?.vencimento}
          required
        />
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          name="recorrente"
          value="sim"
          checked={recorrente}
          onChange={(e) => setRecorrente(e.target.checked)}
          className="size-4 accent-[var(--destaque)]"
        />
        Gasto recorrente mensal (gerado automaticamente todo mês, no mesmo dia)
      </label>
      {recorrente && (
        <Campo
          rotulo="Repetir até (opcional)"
          name="data_fim"
          type="date"
          defaultValue={v.data_fim}
          erro={estado.campos?.data_fim}
          ajuda="Deixe em branco para repetir até você encerrar a recorrência."
        />
      )}
      <div>
        <Botao type="submit" disabled={enviando}>
          {enviando ? "Salvando..." : "Salvar gasto"}
        </Botao>
      </div>
    </form>
  );
}
