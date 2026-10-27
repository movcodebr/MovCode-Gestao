import { describe, expect, it, vi } from "vitest";
import { mensagemErroLogin } from "@/lib/erros-login";

describe("mensagem de erro do login", () => {
  it("senha errada ou e-mail inexistente: mesma mensagem (não revela quem tem acesso)", () => {
    expect(mensagemErroLogin({ code: "invalid_credentials", status: 400 })).toBe("E-mail ou senha incorretos.");
  });

  it("usuário não confirmado e excesso de tentativas têm mensagens próprias", () => {
    expect(mensagemErroLogin({ code: "email_not_confirmed" })).toMatch(/não foi confirmado/);
    expect(mensagemErroLogin({ status: 429 })).toMatch(/Muitas tentativas/);
  });

  it("erro de configuração ou conexão não aparece como senha errada e vai para o log", () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(mensagemErroLogin({ status: 401, message: "Invalid API key" })).toMatch(/configuração ou conexão/);
    expect(log).toHaveBeenCalled();
    log.mockRestore();
  });
});
