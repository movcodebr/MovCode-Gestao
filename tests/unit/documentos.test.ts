import { describe, expect, it } from "vitest";
import { caminhoDocumento, formatarTamanho, nomeSeguro } from "@/lib/dominio/documentos";

describe("documentos", () => {
  it("gera nome seguro para o Storage, sem acentos nem espaços", () => {
    expect(nomeSeguro("Planilha de Preços 2026 (final).xlsx")).toBe("Planilha-de-Precos-2026-final-.xlsx");
    expect(nomeSeguro("prompts/../segredo.txt")).toBe("prompts-.-segredo.txt");
    expect(nomeSeguro("ção")).toBe("cao");
    expect(nomeSeguro("###")).toBe("arquivo");
  });

  it("cada envio fica numa pasta própria", () => {
    expect(caminhoDocumento("abc", "Relatório.pdf")).toBe("abc/Relatorio.pdf");
  });

  it("formata o tamanho", () => {
    expect(formatarTamanho(512)).toBe("512 B");
    expect(formatarTamanho(1536)).toBe("1,5 KB");
    expect(formatarTamanho(5 * 1024 * 1024)).toBe("5 MB");
  });
});
