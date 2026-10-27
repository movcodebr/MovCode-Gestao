import { gzipSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { backupsParaApagar, caminhoBackup, lerArquivoBackup, precisaBackupMensal } from "@/lib/dominio/backup";

describe("retenção dos backups", () => {
  it("mantém os 30 diários e os 12 mensais mais recentes", () => {
    const diarios = Array.from({ length: 33 }, (_, i) => ({
      id: `d${i}`,
      tipo: "diario" as const,
      criadoEm: new Date(Date.UTC(2026, 0, 1 + i)).toISOString(),
    }));
    const mensais = Array.from({ length: 14 }, (_, i) => ({
      id: `m${i}`,
      tipo: "mensal" as const,
      criadoEm: new Date(Date.UTC(2025, i, 1)).toISOString(),
    }));
    expect(backupsParaApagar([...diarios, ...mensais]).sort()).toEqual(["d0", "d1", "d2", "m0", "m1"].sort());
    expect(backupsParaApagar(diarios.slice(0, 30))).toEqual([]);
  });

  it("faz o mensal na primeira rotina do mês", () => {
    expect(precisaBackupMensal(["mensal/2026-09.json.gz"], "2026-10-01")).toBe(true);
    expect(precisaBackupMensal(["mensal/2026-10.json.gz"], "2026-10-02")).toBe(false);
  });

  it("nomeia os arquivos por tipo e data", () => {
    expect(caminhoBackup("diario", "2026-10-27")).toBe("diario/2026-10-27.json.gz");
    expect(caminhoBackup("mensal", "2026-10-27")).toBe("mensal/2026-10.json.gz");
    expect(caminhoBackup("manual", "2026-10-27", "13:20:05")).toBe("diario/2026-10-27-132005-manual.json.gz");
  });
});

describe("leitura do arquivo de backup", () => {
  const valido = { sistema: "movcode-gestao", versao: 1, tabelas: { clientes: [] } };

  it("aceita .json e .json.gz deste sistema", () => {
    expect(lerArquivoBackup(Buffer.from(JSON.stringify(valido)))).toMatchObject({ versao: 1 });
    expect(lerArquivoBackup(gzipSync(JSON.stringify(valido)))).toMatchObject({ versao: 1 });
  });

  it("recusa arquivos de outro tipo", () => {
    expect(() => lerArquivoBackup(Buffer.from("planilha"))).toThrow(/JSON inválido/);
    expect(() => lerArquivoBackup(Buffer.from(JSON.stringify({ versao: 1 })))).toThrow(/deste sistema/);
    expect(() => lerArquivoBackup(Buffer.from([0x1f, 0x8b, 1, 2, 3]))).toThrow(/abrir/);
  });
});
