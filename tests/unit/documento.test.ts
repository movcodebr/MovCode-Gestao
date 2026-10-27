import { describe, expect, it } from "vitest";
import {
  cnpjValido,
  cpfValido,
  documentoValido,
  emailValido,
  formatarDocumento,
  formatarTelefone,
  normalizarDocumento,
  normalizarTelefone,
  telefoneValido,
  tipoDoDocumento,
} from "@/lib/dominio/documento";

describe("CPF", () => {
  it("aceita CPFs com dígito verificador correto, com ou sem pontuação", () => {
    expect(cpfValido("529.982.247-25")).toBe(true);
    expect(cpfValido("52998224725")).toBe(true);
    expect(cpfValido("123.456.789-09")).toBe(true);
  });

  it("rejeita dígito errado, sequência repetida e tamanho errado", () => {
    expect(cpfValido("529.982.247-24")).toBe(false);
    expect(cpfValido("529.982.247-15")).toBe(false);
    expect(cpfValido("111.111.111-11")).toBe(false);
    expect(cpfValido("5299822472")).toBe(false);
    expect(cpfValido("")).toBe(false);
  });
});

describe("CNPJ", () => {
  it("aceita CNPJ numérico e o novo CNPJ alfanumérico", () => {
    expect(cnpjValido("11.222.333/0001-81")).toBe(true);
    expect(cnpjValido("00.000.000/0001-91")).toBe(true);
    expect(cnpjValido("12.ABC.345/01DE-35")).toBe(true);
    expect(cnpjValido("12.abc.345/01de-35")).toBe(true);
  });

  it("rejeita dígito errado, sequência repetida e letras nos dígitos verificadores", () => {
    expect(cnpjValido("11.222.333/0001-82")).toBe(false);
    expect(cnpjValido("11.222.333/0001-71")).toBe(false);
    expect(cnpjValido("00.000.000/0000-00")).toBe(false);
    expect(cnpjValido("12.ABC.345/01DE-36")).toBe(false);
    expect(cnpjValido("12ABC34501DEAB")).toBe(false);
  });
});

describe("tipo do cliente", () => {
  it("é definido automaticamente: CPF = Pessoa Física (PF), CNPJ = Empresa (PJ)", () => {
    expect(tipoDoDocumento("529.982.247-25")).toBe("PF");
    expect(tipoDoDocumento("11.222.333/0001-81")).toBe("PJ");
    expect(tipoDoDocumento("12.ABC.345/01DE-35")).toBe("PJ");
    expect(tipoDoDocumento("123")).toBeNull();
    expect(documentoValido("123")).toBe(false);
  });

  it("normaliza e formata o documento", () => {
    expect(normalizarDocumento("529.982.247-25")).toBe("52998224725");
    expect(normalizarDocumento("12.abc.345/01de-35")).toBe("12ABC34501DE35");
    expect(formatarDocumento("52998224725")).toBe("529.982.247-25");
    expect(formatarDocumento("11222333000181")).toBe("11.222.333/0001-81");
    expect(formatarDocumento("12ABC34501DE35")).toBe("12.ABC.345/01DE-35");
  });
});

describe("telefone com DDD", () => {
  it("aceita celular e fixo com DDD, com ou sem +55 e pontuação", () => {
    expect(telefoneValido("(11) 98765-4321")).toBe(true);
    expect(telefoneValido("+55 11 98765-4321")).toBe(true);
    expect(telefoneValido("(51) 3333-4444")).toBe(true);
    expect(normalizarTelefone("+55 (11) 98765-4321")).toBe("11987654321");
  });

  it("rejeita telefone sem DDD, com DDD inválido ou celular sem o 9", () => {
    expect(telefoneValido("98765-4321")).toBe(false);
    expect(telefoneValido("(01) 98765-4321")).toBe(false);
    expect(telefoneValido("(11) 88765-43210")).toBe(false);
    expect(telefoneValido("(11) 1234-5678")).toBe(false);
  });

  it("formata para exibição", () => {
    expect(formatarTelefone("11987654321")).toBe("(11) 98765-4321");
    expect(formatarTelefone("5133334444")).toBe("(51) 3333-4444");
  });
});

describe("e-mail", () => {
  it("valida o formato", () => {
    expect(emailValido("cliente@empresa.com.br")).toBe(true);
    expect(emailValido(" cliente@empresa.com ")).toBe(true);
    expect(emailValido("cliente@empresa")).toBe(false);
    expect(emailValido("cliente empresa@x.com")).toBe(false);
    expect(emailValido("sem-arroba.com")).toBe(false);
  });
});
