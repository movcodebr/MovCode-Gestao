import { describe, expect, it } from "vitest";
import { autorizacaoConfere } from "@/lib/segredo";

describe("chamadas automáticas (rotinas)", () => {
  it("só entra quem manda o segredo certo no cabeçalho Authorization", () => {
    expect(autorizacaoConfere("Bearer abc123", "abc123")).toBe(true);
    expect(autorizacaoConfere("Bearer abc124", "abc123")).toBe(false);
    expect(autorizacaoConfere("abc123", "abc123")).toBe(false);
    expect(autorizacaoConfere(null, "abc123")).toBe(false);
  });

  it("sem segredo configurado, ninguém entra", () => {
    expect(autorizacaoConfere("Bearer ", "")).toBe(false);
    expect(autorizacaoConfere("Bearer undefined", undefined)).toBe(false);
  });
});
