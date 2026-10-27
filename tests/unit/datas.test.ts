import { describe, expect, it } from "vitest";
import { formatarData, hojeEmBrasilia } from "@/lib/dominio/datas";

describe("datas no fuso de Brasília", () => {
  it("usa o dia de Brasília, não o do servidor (UTC)", () => {
    // 01:30 UTC de 1º/mar ainda é 22:30 de 28/fev em Brasília
    expect(hojeEmBrasilia(new Date("2026-03-01T01:30:00Z"))).toBe("2026-02-28");
    expect(hojeEmBrasilia(new Date("2026-03-01T03:00:00Z"))).toBe("2026-03-01");
  });

  it("formata no padrão brasileiro", () => {
    expect(formatarData("2026-03-20")).toBe("20/03/2026");
  });
});
