/**
 * Dinheiro é sempre representado em CENTAVOS inteiros (nunca ponto flutuante).
 * Ex.: R$ 1.234,56 → 123456.
 */
export type Centavos = number;

export class ValorMonetarioInvalido extends Error {
  constructor(mensagem: string) {
    super(mensagem);
    this.name = "ValorMonetarioInvalido";
  }
}

/** Garante que o valor é um inteiro seguro de centavos. */
export function centavos(valor: number): Centavos {
  if (!Number.isSafeInteger(valor)) {
    throw new ValorMonetarioInvalido(`Valor em centavos inválido: ${valor}`);
  }
  return valor;
}

/** Soma valores em centavos, validando cada parcela. */
export function somar(...valores: Centavos[]): Centavos {
  return centavos(valores.reduce((total, v) => total + centavos(v), 0));
}

const agrupador = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 });

/** Formata centavos como "R$ 1.234,56" sem passar por ponto flutuante. */
export function formatarReais(valor: Centavos): string {
  centavos(valor);
  const negativo = valor < 0;
  const absoluto = Math.abs(valor);
  const reais = Math.trunc(absoluto / 100);
  const resto = absoluto % 100;
  const texto = `R$ ${agrupador.format(reais)},${String(resto).padStart(2, "0")}`;
  return negativo ? `-${texto}` : texto;
}

/**
 * Converte o texto digitado pelo usuário ("1.234,56", "R$ 99,9", "1500") em centavos.
 * Aceita no máximo 2 casas decimais; vírgula é o separador decimal.
 */
export function lerReais(texto: string): Centavos {
  const limpo = texto.replace(/R\$/i, "").replace(/\s/g, "");
  const negativo = limpo.startsWith("-");
  const semSinal = negativo ? limpo.slice(1) : limpo;
  const formato = /^(\d{1,3}(\.\d{3})+|\d+)(,\d{1,2})?$/;
  if (!formato.test(semSinal)) {
    throw new ValorMonetarioInvalido(`Valor inválido: "${texto}"`);
  }
  const [inteiro, decimal = ""] = semSinal.split(",");
  const reais = inteiro.replace(/\./g, "");
  const total = Number(reais) * 100 + Number(decimal.padEnd(2, "0"));
  return centavos(negativo ? -total : total);
}

/** Formata centavos para campo de formulário, sem "R$": 120000 → "1.200,00". */
export function formatarValorCampo(valor: Centavos): string {
  return formatarReais(valor).replace("R$ ", "");
}

/** Como lerReais, mas devolve null em vez de erro (para cálculos enquanto o usuário digita). */
export function tentarLerReais(texto: string): Centavos | null {
  try {
    return lerReais(texto);
  } catch {
    return null;
  }
}
