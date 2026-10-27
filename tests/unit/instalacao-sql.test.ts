import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { gerarInstalacao } from "../../scripts/gerar-instalacao-sql.mjs";

describe("arquivo de instalação do banco", () => {
  it("está atualizado com todas as migrações (rode npm run gerar-instalacao-sql)", () => {
    expect(readFileSync("supabase/instalacao-completa.sql", "utf8")).toBe(gerarInstalacao());
  });
});
