/**
 * CPF, CNPJ, telefone e e-mail: normalização, validação e formatação.
 * A validação de CPF/CNPJ é a mesma da função SQL public.documento_valido.
 */

export type TipoCliente = "PF" | "PJ";

/** Remove pontuação; mantém dígitos e letras (CNPJ alfanumérico), em maiúsculas. */
export function normalizarDocumento(texto: string): string {
  return texto.toUpperCase().replace(/[^0-9A-Z]/g, "");
}

function todosIguais(texto: string): boolean {
  return /^(.)\1*$/.test(texto);
}

export function cpfValido(texto: string): boolean {
  const cpf = normalizarDocumento(texto);
  if (!/^\d{11}$/.test(cpf) || todosIguais(cpf)) return false;
  for (const posicao of [9, 10]) {
    let soma = 0;
    for (let i = 0; i < posicao; i++) soma += Number(cpf[i]) * (posicao + 1 - i);
    const resto = (soma * 10) % 11;
    if ((resto === 10 ? 0 : resto) !== Number(cpf[posicao])) return false;
  }
  return true;
}

const PESOS_CNPJ = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];

/** Aceita CNPJ numérico e o novo CNPJ alfanumérico (12 caracteres + 2 dígitos). */
export function cnpjValido(texto: string): boolean {
  const cnpj = normalizarDocumento(texto);
  if (!/^[0-9A-Z]{12}\d{2}$/.test(cnpj) || todosIguais(cnpj)) return false;
  for (const posicao of [12, 13]) {
    const pesos = PESOS_CNPJ.slice(13 - posicao);
    let soma = 0;
    for (let i = 0; i < posicao; i++) soma += (cnpj.charCodeAt(i) - 48) * pesos[i];
    const resto = soma % 11;
    if ((resto < 2 ? 0 : 11 - resto) !== Number(cnpj[posicao])) return false;
  }
  return true;
}

export function documentoValido(texto: string): boolean {
  return cpfValido(texto) || cnpjValido(texto);
}

/** CPF = Pessoa Física; CNPJ = Empresa. */
export function tipoDoDocumento(texto: string): TipoCliente | null {
  if (cpfValido(texto)) return "PF";
  if (cnpjValido(texto)) return "PJ";
  return null;
}

export function formatarDocumento(texto: string): string {
  const doc = normalizarDocumento(texto);
  if (doc.length === 11) return doc.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, "$1.$2.$3-$4");
  if (doc.length === 14) return doc.replace(/^(.{2})(.{3})(.{3})(.{4})(.{2})$/, "$1.$2.$3/$4-$5");
  return texto;
}

export const NOME_TIPO: Record<TipoCliente, string> = { PF: "Pessoa Física", PJ: "Empresa" };

/** Remove tudo que não é dígito e um eventual código do país (+55). */
export function normalizarTelefone(texto: string): string {
  const digitos = texto.replace(/\D/g, "");
  return digitos.length > 11 && digitos.startsWith("55") ? digitos.slice(2) : digitos;
}

/** Telefone com DDD: fixo (10 dígitos) ou celular (11 dígitos, começando com 9). */
export function telefoneValido(texto: string): boolean {
  return /^[1-9][1-9](9\d{8}|[2-8]\d{7})$/.test(normalizarTelefone(texto));
}

export function formatarTelefone(texto: string): string {
  const tel = normalizarTelefone(texto);
  if (tel.length === 11) return tel.replace(/^(\d{2})(\d{5})(\d{4})$/, "($1) $2-$3");
  if (tel.length === 10) return tel.replace(/^(\d{2})(\d{4})(\d{4})$/, "($1) $2-$3");
  return texto;
}

export function emailValido(texto: string): boolean {
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(texto.trim());
}
