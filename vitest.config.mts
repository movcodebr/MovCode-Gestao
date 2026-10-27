import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      // "server-only" só existe para o Next.js; nos testes vira um módulo vazio
      "server-only": fileURLToPath(new URL("./tests/vazio.ts", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    // Integração precisa do Supabase local: rode com npm run test:integracao
    exclude: process.env.INTEGRACAO ? [] : ["tests/integracao/**"],
    // Os testes de integração usam o mesmo banco local: um arquivo por vez
    fileParallelism: !process.env.INTEGRACAO,
    // Os testes de banco sobem um Postgres em memória (PGlite) e levam alguns segundos.
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
});
