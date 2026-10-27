import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";
import type { LinhaLancamento } from "@/lib/consultas/lancamentos";
import { gerarExcel, gerarPdf } from "@/lib/servicos/exportacao";

const base = {
  forma_pagamento: "pix" as const,
  data_pagamento: null,
  dias_atraso: 0,
  categoria: null,
  cliente_id: null,
  mensalidade_id: null,
  gasto_recorrente_id: null,
  cliente_nome: null,
};
const linhas: LinhaLancamento[] = [
  { ...base, id: "1", tipo: "entrada", descricao: "Site institucional", valor_centavos: 120000, vencimento: "2026-03-05", status_efetivo: "pago", data_pagamento: "2026-03-06", cliente_nome: "Padaria São João" },
  { ...base, id: "2", tipo: "saida", descricao: "Hospedagem", valor_centavos: 8990, vencimento: "2026-03-10", status_efetivo: "atrasado", categoria: "servidor" },
  { ...base, id: "3", tipo: "entrada", descricao: "Mensalidade", valor_centavos: 20001, vencimento: "2026-03-31", status_efetivo: "pendente" },
];

describe("exportação para o contador", () => {
  it("Excel: uma linha por lançamento, saídas negativas e totais corretos", async () => {
    const buffer = await gerarExcel(linhas, "Mov Code — Lançamentos — março de 2026");
    const livro = new ExcelJS.Workbook();
    await livro.xlsx.load(buffer as unknown as ArrayBuffer);
    const aba = livro.getWorksheet("Lançamentos")!;
    expect(aba.getCell("A1").value).toBe("Mov Code — Lançamentos — março de 2026");
    expect(aba.getRow(3).values).toEqual([undefined, "Vencimento", "Descrição", "Cliente", "Tipo", "Categoria", "Forma", "Status", "Pago em", "Valor (R$)"]);
    expect(aba.getRow(4).values).toEqual([undefined, "05/03/2026", "Site institucional", "Padaria São João", "Entrada", "", "Pix", "Pago", "06/03/2026", 1200]);
    expect(aba.getCell("I5").value).toBe(-89.9);
    expect(aba.getCell("E5").value).toBe("Servidor");
    expect(aba.getCell("G5").value).toBe("Atrasado");
    expect(aba.getCell("I8").value).toBe(1400.01); // entradas
    expect(aba.getCell("I9").value).toBe(-89.9); // saídas
    expect(aba.getCell("I10").value).toBe(1310.11); // resultado
  });

  it("PDF: gera um documento válido", async () => {
    const buffer = await gerarPdf(linhas, "Mov Code — Lançamentos — março de 2026", "Vinicius");
    expect(buffer.subarray(0, 5).toString()).toBe("%PDF-");
    expect(buffer.length).toBeGreaterThan(1500);
  });
});
