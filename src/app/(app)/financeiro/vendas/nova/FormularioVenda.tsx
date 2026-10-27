"use client";

import { useActionState, useState } from "react";
import { Botao, Campo, Cartao, Mensagem, Selecao } from "@/components/ui";
import { adicionarMeses } from "@/lib/dominio/datas";
import { formatarReais, formatarValorCampo, tentarLerReais } from "@/lib/dominio/dinheiro";
import { FORMAS_PAGAMENTO } from "@/lib/dominio/lancamentos";
import { registrarVenda } from "../../acoes";

type Produto = { id: string; nome: string; preco: number; mensalidade: number };
type Cliente = { id: string; nome: string };
type Parcela = { valor: string; vencimento: string };

type Props = { clientes: Cliente[]; produtos: Produto[]; hoje: string; clienteInicial?: string };

function AvisoTabela({ valor, tabela }: { valor: string; tabela: number }) {
  const centavos = tentarLerReais(valor);
  if (centavos === null || centavos === tabela) return null;
  return (
    <p role="status" className="rounded-lg border border-alerta/40 bg-alerta/10 px-3 py-2 text-sm text-alerta">
      Valor diferente da tabela ({formatarReais(tabela)}). Os dois valores ficam registrados na venda.
    </p>
  );
}

function OpcoesForma() {
  return Object.entries(FORMAS_PAGAMENTO).map(([valor, rotulo]) => (
    <option key={valor} value={valor}>
      {rotulo}
    </option>
  ));
}

export function FormularioVenda({ clientes, produtos, hoje, clienteInicial }: Props) {
  const [estado, enviar, enviando] = useActionState(registrarVenda, {});
  const [clienteId, setClienteId] = useState(clienteInicial ?? "");
  const [produtoId, setProdutoId] = useState("");
  const [dataVenda, setDataVenda] = useState(hoje);
  const [tipo, setTipo] = useState<"unica" | "mensalidade">("unica");
  const [incluirMensalidade, setIncluirMensalidade] = useState(false);
  const [valorUnica, setValorUnica] = useState("");
  const [formaUnica, setFormaUnica] = useState("pix");
  const [parcelas, setParcelas] = useState<Parcela[]>([{ valor: "", vencimento: hoje }]);
  const [valorMensal, setValorMensal] = useState("");
  const [diaVencimento, setDiaVencimento] = useState(String(Number(hoje.slice(8, 10))));
  const [dataInicio, setDataInicio] = useState(hoje);
  const [formaMensal, setFormaMensal] = useState("pix");

  const produto = produtos.find((p) => p.id === produtoId);
  const temUnica = tipo === "unica";
  const temMensal = tipo === "mensalidade" || incluirMensalidade;

  function escolherProduto(id: string) {
    setProdutoId(id);
    const p = produtos.find((x) => x.id === id);
    if (!p) return;
    setValorUnica(formatarValorCampo(p.preco));
    setValorMensal(formatarValorCampo(p.mensalidade));
    if (parcelas.length === 1) setParcelas([{ ...parcelas[0], valor: formatarValorCampo(p.preco) }]);
  }

  function mudarValorUnica(valor: string) {
    setValorUnica(valor);
    if (parcelas.length === 1) setParcelas([{ ...parcelas[0], valor }]);
  }

  const total = tentarLerReais(valorUnica);
  const soma = parcelas.reduce<number | null>((s, p) => {
    const v = tentarLerReais(p.valor);
    return s === null || v === null ? null : s + v;
  }, 0);
  const restante = total !== null && soma !== null ? total - soma : null;

  function adicionarParcela() {
    const ultima = parcelas[parcelas.length - 1];
    setParcelas([
      ...parcelas,
      {
        valor: restante !== null && restante > 0 ? formatarValorCampo(restante) : "",
        vencimento: adicionarMeses(ultima?.vencimento || hoje, 1),
      },
    ]);
  }

  function mudarParcela(indice: number, campo: keyof Parcela, valor: string) {
    setParcelas(parcelas.map((p, i) => (i === indice ? { ...p, [campo]: valor } : p)));
  }

  const venda = JSON.stringify({
    cliente_id: clienteId,
    produto_id: produtoId,
    data_venda: dataVenda,
    tipo,
    incluir_mensalidade: incluirMensalidade,
    unica: temUnica ? { valor: valorUnica, forma_pagamento: formaUnica, parcelas } : undefined,
    mensalidade: temMensal
      ? { valor: valorMensal, dia_vencimento: diaVencimento, data_inicio: dataInicio, forma_pagamento: formaMensal }
      : undefined,
  });

  return (
    <form action={enviar} className="flex max-w-3xl flex-col gap-5">
      <input type="hidden" name="venda" value={venda} />
      {estado.erro && <Mensagem tipo="erro">{estado.erro}</Mensagem>}

      <div className="grid gap-4 sm:grid-cols-2">
        <Selecao rotulo="Cliente" value={clienteId} onChange={(e) => setClienteId(e.target.value)} required>
          <option value="">Escolha o cliente</option>
          {clientes.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nome}
            </option>
          ))}
        </Selecao>
        <Selecao rotulo="Produto" value={produtoId} onChange={(e) => escolherProduto(e.target.value)} required>
          <option value="">Escolha o produto</option>
          {produtos.map((p) => (
            <option key={p.id} value={p.id}>
              {p.nome}
            </option>
          ))}
        </Selecao>
        <Campo rotulo="Data da venda" type="date" value={dataVenda} onChange={(e) => setDataVenda(e.target.value)} required />
      </div>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-sm text-texto-secundario">Tipo de venda</legend>
        <div className="flex flex-wrap gap-2">
          {(
            [
              ["unica", "Venda única", "usa o Preço"],
              ["mensalidade", "Mensalidade", "usa a Mensalidade"],
            ] as const
          ).map(([valor, rotulo, ajuda]) => (
            <label
              key={valor}
              className={`flex cursor-pointer flex-col rounded-xl border px-4 py-3 text-sm ${
                tipo === valor ? "border-destaque bg-destaque/10" : "border-borda"
              }`}
            >
              <span className="flex items-center gap-2 font-medium">
                <input
                  type="radio"
                  name="tipo_venda"
                  value={valor}
                  checked={tipo === valor}
                  onChange={() => setTipo(valor)}
                  className="accent-[var(--destaque)]"
                />
                {rotulo}
              </span>
              <span className="text-xs text-texto-secundario">{ajuda}</span>
            </label>
          ))}
        </div>
        {tipo === "unica" && (
          <label className="mt-1 flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={incluirMensalidade}
              onChange={(e) => setIncluirMensalidade(e.target.checked)}
              className="size-4 accent-[var(--destaque)]"
            />
            Incluir mensalidade também
          </label>
        )}
      </fieldset>

      {temUnica && (
        <Cartao className="flex flex-col gap-4">
          <h2 className="font-semibold">Venda única</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Campo
              rotulo="Valor da venda, R$"
              inputMode="decimal"
              value={valorUnica}
              onChange={(e) => mudarValorUnica(e.target.value)}
              required
            />
            <Selecao rotulo="Forma de pagamento" value={formaUnica} onChange={(e) => setFormaUnica(e.target.value)}>
              <OpcoesForma />
            </Selecao>
          </div>
          {produto && <AvisoTabela valor={valorUnica} tabela={produto.preco} />}

          <div className="flex flex-col gap-3">
            <h3 className="text-sm font-medium text-texto-secundario">Parcelas</h3>
            {parcelas.map((p, i) => (
              <div key={i} className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] items-end gap-2">
                <Campo
                  rotulo={`Parcela ${i + 1}, R$`}
                  inputMode="decimal"
                  value={p.valor}
                  onChange={(e) => mudarParcela(i, "valor", e.target.value)}
                  required
                />
                <Campo
                  rotulo="Vencimento"
                  type="date"
                  value={p.vencimento}
                  onChange={(e) => mudarParcela(i, "vencimento", e.target.value)}
                  required
                />
                <button
                  type="button"
                  onClick={() => setParcelas(parcelas.filter((_, j) => j !== i))}
                  disabled={parcelas.length === 1}
                  aria-label={`Remover parcela ${i + 1}`}
                  className="mb-1 rounded-lg px-1.5 py-2 text-texto-secundario hover:text-perigo disabled:invisible sm:px-3"
                >
                  ✕
                </button>
              </div>
            ))}
            <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
              <button type="button" onClick={adicionarParcela} className="text-destaque hover:underline">
                + Adicionar parcela
              </button>
              {restante !== null && (
                <span className={restante === 0 ? "text-sucesso" : "text-perigo"}>
                  {restante === 0
                    ? "Parcelas fecham com o valor da venda"
                    : restante > 0
                      ? `Faltam ${formatarReais(restante)}`
                      : `Passou ${formatarReais(-restante)} do valor da venda`}
                </span>
              )}
            </div>
          </div>
        </Cartao>
      )}

      {temMensal && (
        <Cartao className="flex flex-col gap-4">
          <h2 className="font-semibold">Mensalidade</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Campo
              rotulo="Valor mensal, R$"
              inputMode="decimal"
              value={valorMensal}
              onChange={(e) => setValorMensal(e.target.value)}
              required
            />
            <Selecao rotulo="Forma de pagamento" value={formaMensal} onChange={(e) => setFormaMensal(e.target.value)}>
              <OpcoesForma />
            </Selecao>
            <Campo
              rotulo="Dia de vencimento combinado"
              type="number"
              min={1}
              max={31}
              value={diaVencimento}
              onChange={(e) => setDiaVencimento(e.target.value)}
              ajuda="De 1 a 31. Em meses mais curtos, vence no último dia do mês."
              required
            />
            <Campo
              rotulo="Data de início"
              type="date"
              value={dataInicio}
              onChange={(e) => setDataInicio(e.target.value)}
              ajuda="A 1ª cobrança vence no primeiro dia de vencimento a partir desta data."
              required
            />
          </div>
          {produto && <AvisoTabela valor={valorMensal} tabela={produto.mensalidade} />}
        </Cartao>
      )}

      <div>
        <Botao type="submit" disabled={enviando}>
          {enviando ? "Salvando..." : "Salvar venda"}
        </Botao>
      </div>
    </form>
  );
}
