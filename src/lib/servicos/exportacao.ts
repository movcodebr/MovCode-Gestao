import "server-only";
import ExcelJS from "exceljs";
import pdfmake from "pdfmake";
import type { TableCell } from "pdfmake/interfaces";
import type { LinhaLancamento } from "@/lib/consultas/lancamentos";
import { formatarData } from "@/lib/dominio/datas";
import { formatarReais } from "@/lib/dominio/dinheiro";
import { CATEGORIAS_GASTO, FORMAS_PAGAMENTO, STATUS_LANCAMENTO } from "@/lib/dominio/lancamentos";

const COLUNAS = ["Vencimento", "Descrição", "Cliente", "Tipo", "Categoria", "Forma", "Status", "Pago em", "Valor (R$)"];

function totais(linhas: LinhaLancamento[]) {
  const entradas = linhas.filter((l) => l.tipo === "entrada").reduce((s, l) => s + l.valor_centavos, 0);
  const saidas = linhas.filter((l) => l.tipo === "saida").reduce((s, l) => s + l.valor_centavos, 0);
  return { entradas, saidas, resultado: entradas - saidas };
}

function celulas(l: LinhaLancamento) {
  return {
    vencimento: formatarData(l.vencimento),
    descricao: l.descricao,
    cliente: l.cliente_nome ?? "",
    tipo: l.tipo === "entrada" ? "Entrada" : "Saída",
    categoria: l.categoria ? CATEGORIAS_GASTO[l.categoria] : "",
    forma: FORMAS_PAGAMENTO[l.forma_pagamento],
    status: STATUS_LANCAMENTO[l.status_efetivo],
    pagoEm: l.data_pagamento ? formatarData(l.data_pagamento) : "",
  };
}

/** Planilha .xlsx com os lançamentos filtrados (valores como número, com 2 casas). */
export async function gerarExcel(linhas: LinhaLancamento[], titulo: string): Promise<Buffer> {
  const livro = new ExcelJS.Workbook();
  livro.creator = "Mov Code — Gestão";
  const aba = livro.addWorksheet("Lançamentos");
  aba.addRow([titulo]).font = { bold: true, size: 14 };
  aba.addRow([]);
  const cabecalho = aba.addRow(COLUNAS);
  cabecalho.font = { bold: true };
  for (const l of linhas) {
    const c = celulas(l);
    // Saídas negativas para o contador somar direto
    const valor = (l.tipo === "entrada" ? l.valor_centavos : -l.valor_centavos) / 100;
    aba.addRow([c.vencimento, c.descricao, c.cliente, c.tipo, c.categoria, c.forma, c.status, c.pagoEm, valor]);
  }
  const t = totais(linhas);
  aba.addRow([]);
  aba.addRow(["", "Total de entradas", "", "", "", "", "", "", t.entradas / 100]).font = { bold: true };
  aba.addRow(["", "Total de saídas", "", "", "", "", "", "", -t.saidas / 100]).font = { bold: true };
  aba.addRow(["", "Resultado", "", "", "", "", "", "", t.resultado / 100]).font = { bold: true };
  aba.getColumn(9).numFmt = '#,##0.00;[Red]-#,##0.00';
  const larguras = [12, 40, 28, 10, 14, 10, 11, 12, 14];
  larguras.forEach((w, i) => (aba.getColumn(i + 1).width = w));
  return Buffer.from(await livro.xlsx.writeBuffer());
}

const FONTES = { normal: "Helvetica", bold: "Helvetica-Bold", italics: "Helvetica-Oblique", bolditalics: "Helvetica-BoldOblique" };
pdfmake.setFonts({ Helvetica: FONTES });
// O PDF não busca nada da internet; do "disco", só as fontes padrão embutidas no PDF
pdfmake.setUrlAccessPolicy(() => false);
pdfmake.setLocalAccessPolicy((caminho: string) => Object.values(FONTES).includes(caminho));

/** PDF (paisagem) com os lançamentos filtrados e os totais. */
export async function gerarPdf(linhas: LinhaLancamento[], titulo: string, geradoPor: string): Promise<Buffer> {
  const t = totais(linhas);
  const corpo: TableCell[][] = [
    COLUNAS.map((c) => ({ text: c, bold: true })),
    ...linhas.map((l): TableCell[] => {
      const c = celulas(l);
      const valor = formatarReais(l.tipo === "entrada" ? l.valor_centavos : -l.valor_centavos);
      return [c.vencimento, c.descricao, c.cliente, c.tipo, c.categoria, c.forma, c.status, c.pagoEm, { text: valor, alignment: "right" as const }];
    }),
  ];
  const documento = pdfmake.createPdf({
    pageOrientation: "landscape",
    pageSize: "A4",
    pageMargins: [28, 36, 28, 36],
    defaultStyle: { font: "Helvetica", fontSize: 8 },
    info: { title: titulo, author: "Mov Code" },
    content: [
      { text: titulo, fontSize: 14, bold: true },
      { text: `Gerado em ${new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })} por ${geradoPor}`, margin: [0, 2, 0, 10], color: "#555555" },
      {
        table: { headerRows: 1, widths: [48, "*", 90, 40, 52, 40, 44, 48, 62], body: corpo },
        layout: "lightHorizontalLines",
      },
      {
        margin: [0, 12, 0, 0],
        table: {
          widths: ["*", 90],
          body: [
            ["Total de entradas", { text: formatarReais(t.entradas), alignment: "right" }],
            ["Total de saídas", { text: formatarReais(-t.saidas), alignment: "right" }],
            [{ text: "Resultado", bold: true }, { text: formatarReais(t.resultado), alignment: "right", bold: true }],
          ],
        },
        layout: "noBorders",
      },
    ],
    footer: (pagina: number, total: number) => ({ text: `${pagina}/${total}`, alignment: "right", margin: [0, 0, 28, 0], fontSize: 7 }),
  });
  return Buffer.from(await documento.getBuffer());
}
