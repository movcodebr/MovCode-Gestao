import { z } from "zod";
import { lerReais } from "./dinheiro";
import {
  documentoValido,
  emailValido,
  normalizarDocumento,
  normalizarTelefone,
  telefoneValido,
} from "./documento";

/** Campo de valor em reais digitado como texto ("1.200,00") → centavos. */
function campoReais(rotulo: string) {
  return z.string().transform((texto, ctx) => {
    try {
      const valor = lerReais(texto);
      if (valor < 0) throw new Error();
      return valor;
    } catch {
      ctx.addIssue({ code: "custom", message: `Informe ${rotulo} válido, como 1.200,00.` });
      return z.NEVER;
    }
  });
}

export const esquemaProduto = z.object({
  nome: z.string().trim().min(1, "Informe o nome do produto.").max(100, "Nome muito longo."),
  preco: campoReais("um preço"),
  mensalidade: campoReais("uma mensalidade"),
});

export type DadosProduto = z.infer<typeof esquemaProduto>;

export const esquemaCliente = z.object({
  nome: z.string().trim().min(1, "Informe o nome do cliente.").max(150, "Nome muito longo."),
  telefone: z
    .string()
    .refine(telefoneValido, "Telefone inválido: informe com DDD, como (11) 98765-4321.")
    .transform(normalizarTelefone),
  email: z
    .string()
    .trim()
    .refine(emailValido, "E-mail inválido.")
    .transform((email) => email.toLowerCase()),
  documento: z
    .string()
    .refine(documentoValido, "CPF ou CNPJ inválido: confira os números.")
    .transform(normalizarDocumento),
  status: z.enum(["ativo", "inativo"], { message: "Escolha o status." }),
});

export type DadosCliente = z.infer<typeof esquemaCliente>;
