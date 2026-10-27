import { describe, expect, it } from "vitest";
import { buscarIpcaBcb, lerRespostaSgs } from "@/lib/servicos/ipca-bcb";

describe("IPCA do Banco Central (SGS, série 433)", () => {
  it("lê a resposta oficial da API", () => {
    const mapa = lerRespostaSgs([
      { data: "01/11/2026", valor: "0.39" },
      { data: "01/12/2026", valor: "-0.02" },
    ]);
    expect([...mapa]).toEqual([
      ["2026-11", "0.39"],
      ["2026-12", "-0.02"],
    ]);
  });

  it("recusa respostas fora do formato esperado", () => {
    expect(() => lerRespostaSgs({ erro: "x" })).toThrow(/inesperada/);
    expect(() => lerRespostaSgs([{ data: "2026-11-01", valor: "0.39" }])).toThrow(/inesperada/);
    expect(() => lerRespostaSgs([{ data: "01/11/2026", valor: "abc" }])).toThrow(/inesperada/);
  });

  it("pede os últimos 30 meses da série 433 e informa falha da API", async () => {
    let urlPedida = "";
    const falso = (async (url: string) => {
      urlPedida = url;
      return new Response(JSON.stringify([{ data: "01/09/2026", valor: "0.44" }]));
    }) as unknown as typeof fetch;
    const mapa = await buscarIpcaBcb("2026-10-27", falso);
    expect(urlPedida).toBe(
      "https://api.bcb.gov.br/dados/serie/bcdata.sgs.433/dados?formato=json&dataInicial=01/04/2024&dataFinal=01/10/2026",
    );
    expect(mapa.get("2026-09")).toBe("0.44");

    const fora = (async () => new Response("erro", { status: 503 })) as unknown as typeof fetch;
    await expect(buscarIpcaBcb("2026-10-27", fora)).rejects.toThrow(/503/);
  });
});
