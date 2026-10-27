import { PGlite } from "@electric-sql/pglite";
import { afterAll, describe, expect, it } from "vitest";

// Garante que o Postgres em memória usado nos testes de banco funciona no CI.
describe("infraestrutura de testes de banco", () => {
  const db = new PGlite();
  afterAll(() => db.close());

  it("executa SQL no Postgres em memória", async () => {
    const { rows } = await db.query<{ soma: number }>("select 2 + 2 as soma");
    expect(rows[0].soma).toBe(4);
  });
});
