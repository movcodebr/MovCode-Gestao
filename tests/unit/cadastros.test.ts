import { describe, expect, it } from "vitest";
import { esquemaCliente, esquemaProduto } from "@/lib/dominio/cadastros";

describe("formulário de produto", () => {
  it("converte preço e mensalidade digitados para centavos", () => {
    const r = esquemaProduto.parse({ nome: " Site institucional ", preco: "1.200,00", mensalidade: "200" });
    expect(r).toEqual({ nome: "Site institucional", preco: 120000, mensalidade: 20000 });
  });

  it("recusa nome vazio e valores inválidos ou negativos", () => {
    const r = esquemaProduto.safeParse({ nome: " ", preco: "abc", mensalidade: "-10,00" });
    expect(r.success).toBe(false);
    const campos = r.error!.issues.map((i) => i.path[0]);
    expect(campos).toEqual(expect.arrayContaining(["nome", "preco", "mensalidade"]));
  });
});

describe("formulário de cliente", () => {
  const valido = {
    nome: "Padaria do João",
    telefone: "(11) 98765-4321",
    email: "Joao@Padaria.com.br",
    documento: "11.222.333/0001-81",
    status: "ativo",
  };

  it("normaliza telefone, e-mail e documento", () => {
    expect(esquemaCliente.parse(valido)).toEqual({
      nome: "Padaria do João",
      telefone: "11987654321",
      email: "joao@padaria.com.br",
      documento: "11222333000181",
      status: "ativo",
    });
  });

  it("aponta o erro de cada campo inválido", () => {
    const r = esquemaCliente.safeParse({ ...valido, telefone: "98765-4321", email: "x@", documento: "111.111.111-11" });
    expect(r.success).toBe(false);
    const campos = Object.fromEntries(r.error!.issues.map((i) => [i.path[0], i.message]));
    expect(campos.telefone).toMatch(/DDD/);
    expect(campos.email).toMatch(/E-mail inválido/);
    expect(campos.documento).toMatch(/CPF ou CNPJ inválido/);
  });
});
