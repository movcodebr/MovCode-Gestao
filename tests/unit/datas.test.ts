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

import { adicionarMeses, ultimoDiaDoMes } from "@/lib/dominio/datas";

describe("meses curtos", () => {
  it("dia 31 cai no último dia do mês quando o mês é mais curto", () => {
    expect(adicionarMeses("2026-01-31", 1)).toBe("2026-02-28");
    expect(adicionarMeses("2028-01-31", 1)).toBe("2028-02-29");
    expect(adicionarMeses("2026-01-31", 3)).toBe("2026-04-30");
    expect(adicionarMeses("2026-12-15", 1)).toBe("2027-01-15");
    expect(ultimoDiaDoMes(2026, 2)).toBe(28);
  });
});
