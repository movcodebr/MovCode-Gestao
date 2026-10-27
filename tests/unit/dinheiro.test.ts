import { describe, expect, it } from "vitest";
import {
  centavos,
  formatarReais,
  lerReais,
  somar,
  ValorMonetarioInvalido,
} from "@/lib/dominio/dinheiro";

describe("dinheiro em centavos", () => {
  it("rejeita valores que não são inteiros", () => {
    expect(() => centavos(10.5)).toThrow(ValorMonetarioInvalido);
    expect(() => centavos(Number.NaN)).toThrow(ValorMonetarioInvalido);
    expect(centavos(0)).toBe(0);
  });

  it("soma sem erro de ponto flutuante (0,10 + 0,20 = 0,30)", () => {
    expect(somar(10, 20)).toBe(30);
    expect(somar(lerReais("0,10"), lerReais("0,20"))).toBe(lerReais("0,30"));
  });

  it("formata em reais no padrão brasileiro", () => {
    expect(formatarReais(0)).toBe("R$ 0,00");
    expect(formatarReais(5)).toBe("R$ 0,05");
    expect(formatarReais(120000)).toBe("R$ 1.200,00");
    expect(formatarReais(123456789)).toBe("R$ 1.234.567,89");
    expect(formatarReais(-1550)).toBe("-R$ 15,50");
  });

  it("lê valores digitados pelo usuário", () => {
    expect(lerReais("1.234,56")).toBe(123456);
    expect(lerReais("R$ 99,9")).toBe(9990);
    expect(lerReais("1500")).toBe(150000);
    expect(lerReais("0,01")).toBe(1);
    expect(lerReais("-15,50")).toBe(-1550);
  });

  it("rejeita textos inválidos ou com mais de 2 casas decimais", () => {
    for (const texto of ["", "abc", "1,234", "1.23,45", "12.5", "1,2,3"]) {
      expect(() => lerReais(texto), texto).toThrow(ValorMonetarioInvalido);
    }
  });
});
