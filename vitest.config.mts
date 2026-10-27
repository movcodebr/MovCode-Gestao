import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    // Integração precisa do Supabase local: rode com npm run test:integracao
    exclude: process.env.INTEGRACAO ? [] : ["tests/integracao/**"],
    // Os testes de banco sobem um Postgres em memória (PGlite) e levam alguns segundos.
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
});
