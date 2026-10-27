import { describe, expect, it } from "vitest";
import { destinoSeguro, rotaPublica } from "@/lib/rotas";

describe("acesso às rotas", () => {
  it("só login, recuperação de senha e rotina automática abrem sem login", () => {
    for (const rota of ["/login", "/esqueci-senha", "/auth/confirmar", "/api/cron/diario"]) {
      expect(rotaPublica(rota), rota).toBe(true);
    }
    for (const rota of ["/", "/inicio", "/financeiro", "/clientes/1", "/documentos", "/redefinir-senha", "/loginx"]) {
      expect(rotaPublica(rota), rota).toBe(false);
    }
  });

  it("depois do login, só redireciona para caminhos internos", () => {
    expect(destinoSeguro("/clientes")).toBe("/clientes");
    expect(destinoSeguro(undefined)).toBe("/inicio");
    expect(destinoSeguro("")).toBe("/inicio");
    expect(destinoSeguro("https://golpe.com")).toBe("/inicio");
    expect(destinoSeguro("//golpe.com")).toBe("/inicio");
    expect(destinoSeguro("/\\golpe.com")).toBe("/inicio");
    expect(destinoSeguro("/\t/golpe.com")).toBe("/inicio");
    expect(destinoSeguro("/\n/golpe.com")).toBe("/inicio");
  });
});
