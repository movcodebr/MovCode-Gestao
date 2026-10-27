import { z } from "zod";
import { type Centavos, lerReais } from "./dinheiro";
import { dataValida } from "./datas";

export const FORMAS_PAGAMENTO = { pix: "Pix", cartao: "Cartão", boleto: "Boleto" } as const;
export type FormaPagamento = keyof typeof FORMAS_PAGAMENTO;

export const CATEGORIAS_GASTO = {
  servidor: "Servidor",
  ferramentas: "Ferramentas",
  impostos: "Impostos",
  salarios: "Salários",
  marketing: "Marketing",
} as const;
export type CategoriaGasto = keyof typeof CATEGORIAS_GASTO;

export const STATUS_LANCAMENTO = { pago: "Pago", pendente: "Pendente", atrasado: "Atrasado" } as const;
export type StatusLancamento = keyof typeof STATUS_LANCAMENTO;

/** Pendente com vencimento passado vira Atrasado (mesma regra da view v_lancamentos). */
export function statusEfetivo(status: "pago" | "pendente", vencimento: string, hoje: string): StatusLancamento {
  if (status === "pago") return "pago";
  return vencimento < hoje ? "atrasado" : "pendente";
}

/** O valor praticado é diferente do valor da tabela de produtos? */
export function valorDiferenteDaTabela(valor: Centavos, valorTabela: Centavos): boolean {
  return valor !== valorTabela;
}

export type Parcela = { valor: Centavos; vencimento: string };

/** Confere as parcelas de uma venda única. Devolve a mensagem de erro ou null se estiver tudo certo. */
export function validarParcelas(total: Centavos, parcelas: Parcela[]): string | null {
  if (parcelas.length === 0) return "Informe ao menos uma parcela.";
  if (parcelas.some((p) => p.valor <= 0)) return "Toda parcela precisa ter valor maior que zero.";
  if (parcelas.some((p) => !dataValida(p.vencimento))) return "Informe a data de vencimento de cada parcela.";
  const soma = parcelas.reduce((s, p) => s + p.valor, 0);
  if (soma !== total) return "A soma das parcelas precisa ser igual ao valor da venda.";
  return null;
}

// ---------------------------------------------------------------------
// Esquemas dos formulários
// ---------------------------------------------------------------------

const valorPositivo = (rotulo: string) =>
  z.string().transform((texto, ctx) => {
    try {
      const valor = lerReais(texto);
      if (valor <= 0) throw new Error();
      return valor;
    } catch {
      ctx.addIssue({ code: "custom", message: `Informe ${rotulo} maior que zero, como 1.200,00.` });
      return z.NEVER;
    }
  });

const data = (mensagem: string) => z.string().refine(dataValida, mensagem);
const forma = z.enum(["pix", "cartao", "boleto"], { message: "Escolha a forma de pagamento." });
const categoria = z.enum(["servidor", "ferramentas", "impostos", "salarios", "marketing"], {
  message: "Escolha a categoria.",
});

/** Dados enviados pelo formulário de venda (em JSON). */
export const esquemaVenda = z
  .object({
    cliente_id: z.uuid("Escolha o cliente."),
    produto_id: z.uuid("Escolha o produto."),
    data_venda: data("Informe a data da venda."),
    tipo: z.enum(["unica", "mensalidade"]),
    incluir_mensalidade: z.boolean(),
    unica: z
      .object({
        valor: valorPositivo("o valor da venda"),
        forma_pagamento: forma,
        parcelas: z.array(z.object({ valor: valorPositivo("o valor da parcela"), vencimento: z.string() })),
      })
      .optional(),
    mensalidade: z
      .object({
        valor: valorPositivo("o valor da mensalidade"),
        dia_vencimento: z.coerce
          .number({ message: "Informe o dia de vencimento." })
          .int("Dia de vencimento inválido.")
          .min(1, "O dia de vencimento vai de 1 a 31.")
          .max(31, "O dia de vencimento vai de 1 a 31."),
        data_inicio: data("Informe a data de início da mensalidade."),
        forma_pagamento: forma,
      })
      .optional(),
  })
  .superRefine((v, ctx) => {
    const temUnica = v.tipo === "unica";
    const temMensal = v.tipo === "mensalidade" || (temUnica && v.incluir_mensalidade);
    if (temUnica && !v.unica) ctx.addIssue({ code: "custom", path: ["unica"], message: "Preencha a venda única." });
    if (temMensal && !v.mensalidade) {
      ctx.addIssue({ code: "custom", path: ["mensalidade"], message: "Preencha a mensalidade." });
    }
    if (temUnica && v.unica) {
      const erro = validarParcelas(v.unica.valor, v.unica.parcelas);
      if (erro) ctx.addIssue({ code: "custom", path: ["parcelas"], message: erro });
    }
  })
  .transform((v) => ({
    ...v,
    unica: v.tipo === "unica" ? v.unica : undefined,
    mensalidade: v.tipo === "mensalidade" || v.incluir_mensalidade ? v.mensalidade : undefined,
  }));

export type DadosVenda = z.infer<typeof esquemaVenda>;

export const esquemaGasto = z
  .object({
    descricao: z.string().trim().min(1, "Descreva o gasto.").max(200, "Descrição muito longa."),
    categoria,
    valor: valorPositivo("o valor"),
    forma_pagamento: forma,
    vencimento: data("Informe a data de vencimento."),
    recorrente: z.enum(["sim", "nao"]).default("nao"),
    data_fim: z.string().optional(),
  })
  .superRefine((v, ctx) => {
    if (v.recorrente === "sim" && v.data_fim) {
      if (!dataValida(v.data_fim)) {
        ctx.addIssue({ code: "custom", path: ["data_fim"], message: "Data final inválida." });
      } else if (v.data_fim < v.vencimento) {
        ctx.addIssue({ code: "custom", path: ["data_fim"], message: "A data final precisa ser depois do primeiro vencimento." });
      }
    }
  });

/** Edição de um lançamento existente. */
export const esquemaEdicaoLancamento = z
  .object({
    descricao: z.string().trim().min(1, "Informe a descrição.").max(200, "Descrição muito longa."),
    valor: valorPositivo("o valor"),
    forma_pagamento: forma,
    vencimento: data("Informe a data de vencimento."),
    categoria: categoria.optional(),
    status: z.enum(["pago", "pendente"]),
    data_pagamento: z.string().optional(),
  })
  .superRefine((v, ctx) => {
    if (v.status === "pago" && !dataValida(v.data_pagamento ?? "")) {
      ctx.addIssue({ code: "custom", path: ["data_pagamento"], message: "Informe a data em que foi pago." });
    }
  })
  .transform((v) => ({ ...v, data_pagamento: v.status === "pago" ? v.data_pagamento! : null }));

/** Baixa de pagamento: data em que o dinheiro entrou/saiu e a forma usada. */
export const esquemaPagamento = z.object({
  data_pagamento: data("Informe a data do pagamento."),
  forma_pagamento: forma,
});

/** Edição de gasto recorrente: novo valor e data final valem para os meses seguintes. */
export const esquemaGastoRecorrente = z.object({
  descricao: z.string().trim().min(1, "Descreva o gasto.").max(200, "Descrição muito longa."),
  categoria,
  valor: valorPositivo("o valor"),
  forma_pagamento: forma,
  data_fim: z.string().refine((d) => d === "" || dataValida(d), "Data final inválida."),
});
