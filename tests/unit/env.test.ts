import { describe, expect, it } from "vitest";
import { normalizarUrlSupabase } from "@/lib/env";

describe("URL do Supabase", () => {
  it("usa só o endereço base, mesmo com caminho, barra final ou sem https", () => {
    for (const valor of [
      "https://abcd.supabase.co",
      "https://abcd.supabase.co/",
      "https://abcd.supabase.co/rest/v1/",
      "https://abcd.supabase.co/rest/v1",
      " abcd.supabase.co ",
    ]) {
      expect(normalizarUrlSupabase(valor), valor).toBe("https://abcd.supabase.co");
    }
    expect(normalizarUrlSupabase("http://localhost:54321/")).toBe("http://localhost:54321");
  });

  it("recusa valor que não é endereço", () => {
    expect(() => normalizarUrlSupabase("chave errada colada aqui")).toThrow(/inválida/);
  });
});
