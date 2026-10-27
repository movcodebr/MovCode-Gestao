import { describe, expect, it } from "vitest";
import {
  type ClienteParaLembrete,
  type CobrancaParaLembrete,
  type GrupoLembrete,
  pausaVigente,
  planejarLembretes,
} from "@/lib/dominio/lembretes";
import { canaisAtivos, canalEmailResend, type CanalEnvio } from "@/lib/lembretes/canais";
import { enviarLembretes, type RegistroLembretes } from "@/lib/lembretes/envio";
import { montarMensagem } from "@/lib/lembretes/mensagens";

const cliente = (extra: Partial<ClienteParaLembrete> = {}): ClienteParaLembrete => ({
  id: "c1",
  nome: "Padaria do João",
  email: "joao@padaria.com.br",
  telefone: "11987654321",
  ativo: true,
  pausas: [],
  ...extra,
});

const cobranca = (extra: Partial<CobrancaParaLembrete> = {}): CobrancaParaLembrete => ({
  lancamentoId: "l1",
  clienteId: "c1",
  produto: "Site institucional",
  valor: 20000,
  vencimento: "2026-03-10",
  pago: false,
  mensalidadeAtiva: true,
  ...extra,
});

const planejar = (cobrancas: CobrancaParaLembrete[], c: ClienteParaLembrete, hoje: string) =>
  planejarLembretes(cobrancas, new Map([[c.id, c]]), hoje);

/** Dias (desde o vencimento) em que a cobrança recebe lembrete, de −5 a 40. */
function diasComLembrete(c: ClienteParaLembrete, cob = cobranca()): number[] {
  const dias: number[] = [];
  for (let d = -5; d <= 40; d++) {
    const hoje = new Date(Date.parse("2026-03-10T12:00:00Z") + d * 86_400_000).toISOString().slice(0, 10);
    if (planejar([cob], c, hoje).length > 0) dias.push(d);
  }
  return dias;
}

describe("calendário dos lembretes", () => {
  it("1º no vencimento e depois a cada 3 dias; nada antes do vencimento; último no 30º dia", () => {
    expect(diasComLembrete(cliente())).toEqual([0, 3, 6, 9, 12, 15, 18, 21, 24, 27, 30]);
  });

  it("vence hoje vs. atraso: guarda os dias de atraso de cada cobrança", () => {
    expect(planejar([cobranca()], cliente(), "2026-03-10")[0].itens[0].diasAtraso).toBe(0);
    expect(planejar([cobranca()], cliente(), "2026-03-16")[0].itens[0].diasAtraso).toBe(6);
  });

  it("para imediatamente quando a cobrança é paga", () => {
    expect(planejar([cobranca({ pago: true })], cliente(), "2026-03-13")).toEqual([]);
  });
});

describe("quem recebe lembrete", () => {
  it("só mensalidades ativas de clientes ativos", () => {
    expect(planejar([cobranca({ mensalidadeAtiva: false })], cliente(), "2026-03-10")).toEqual([]);
    expect(planejar([cobranca()], cliente({ ativo: false }), "2026-03-10")).toEqual([]);
  });

  it("agrupa várias cobranças do mesmo cliente no mesmo dia num único lembrete", () => {
    const grupos = planejar(
      [
        cobranca(),
        cobranca({ lancamentoId: "l2", produto: "Software / app sob medida", valor: 70000, vencimento: "2026-03-07" }),
        cobranca({ lancamentoId: "l3", produto: "Landing page", vencimento: "2026-03-08" }), // 2 dias: não é dia de lembrete
      ],
      cliente(),
      "2026-03-10",
    );
    expect(grupos).toHaveLength(1);
    expect(grupos[0].itens.map((i) => [i.lancamentoId, i.diasAtraso])).toEqual([
      ["l1", 0],
      ["l2", 3],
    ]);
  });
});

describe("pausa de lembretes", () => {
  const pausa = { inicio: "2026-03-11", fim: "2026-03-20", retomadoEm: null };

  it("bloqueia os envios durante a pausa e volta sozinha na data final", () => {
    const pausado = cliente({ pausas: [pausa] });
    expect(diasComLembrete(pausado)).toEqual([0, 12, 15, 18, 21, 24, 27, 30]);
    expect(pausaVigente([pausa], "2026-03-19")).not.toBeNull();
    expect(pausaVigente([pausa], "2026-03-20")).toBeNull();
  });

  it("não envia retroativo: depois da pausa segue o próximo dia do calendário", () => {
    // pausa até 14/03 (dia 4): o lembrete do dia 3 (13/03) não sai depois; o próximo é o do dia 6
    const pausado = cliente({ pausas: [{ inicio: "2026-03-11", fim: "2026-03-14", retomadoEm: null }] });
    expect(diasComLembrete(pausado)).toEqual([0, 6, 9, 12, 15, 18, 21, 24, 27, 30]);
  });

  it("retomada manual antes da data final libera os lembretes", () => {
    const retomado = cliente({ pausas: [{ ...pausa, retomadoEm: "2026-03-15" }] });
    expect(diasComLembrete(retomado)).toEqual([0, 6, 9, 12, 15, 18, 21, 24, 27, 30]);
  });

  it("a contagem dos 30 dias é sempre a partir do vencimento, mesmo com pausa", () => {
    // pausa termina no 26º dia: sobram só os lembretes dos dias 27 e 30 (o limite não é estendido)
    const ate26 = cliente({ pausas: [{ inicio: "2026-03-01", fim: "2026-04-05", retomadoEm: null }] });
    expect(diasComLembrete(ate26)).toEqual([27, 30]);
    // pausa que passa do 30º dia: nenhum lembrete automático (a cobrança vai para Contato pessoal)
    const ate31 = cliente({ pausas: [{ inicio: "2026-03-01", fim: "2026-04-10", retomadoEm: null }] });
    expect(diasComLembrete(ate31)).toEqual([]);
  });
});

describe("mensagem", () => {
  const pagamento = { chavePix: "00000000000", favorecido: "Mov Code" };
  const grupo = (itens: GrupoLembrete["itens"]): GrupoLembrete => ({ cliente: cliente(), itens });
  const item = { lancamentoId: "l1", produto: "Site institucional", valor: 20000, vencimento: "2026-03-10", diasAtraso: 0 };

  it("no vencimento avisa que vence hoje, com nome, produto, valor, data e Pix", () => {
    const m = montarMensagem(grupo([item]), pagamento);
    expect(m.assunto).toBe("Sua mensalidade Mov Code vence hoje");
    for (const trecho of ["Oi, Padaria do João!", "Site institucional", "R$ 200,00", "vence hoje (10/03/2026)", "Chave Pix: 00000000000", "Favorecido: Mov Code"]) {
      expect(m.texto).toContain(trecho);
    }
    expect(m.html).toContain("Padaria do João");
  });

  it("em atraso informa há quantos dias", () => {
    const m = montarMensagem(grupo([{ ...item, diasAtraso: 6 }]), pagamento);
    expect(m.assunto).toBe("Mensalidade Mov Code em aberto há 6 dias");
    expect(m.texto).toContain("venceu em 10/03/2026 (há 6 dias)");
  });

  it("várias cobranças: lista todas e mostra o total", () => {
    const m = montarMensagem(grupo([item, { ...item, lancamentoId: "l2", produto: "App", valor: 70000, diasAtraso: 9 }]), pagamento);
    expect(m.assunto).toBe("Lembrete de pagamento — Mov Code");
    expect(m.texto).toContain("Total: R$ 900,00");
  });

  it("escapa caracteres especiais no HTML", () => {
    const m = montarMensagem({ cliente: cliente({ nome: "<script>x</script>" }), itens: [item] }, pagamento);
    expect(m.html).not.toContain("<script>");
  });
});

describe("envio e registro", () => {
  const pagamento = { chavePix: "x", favorecido: "y" };
  const grupos = planejar([cobranca(), cobranca({ lancamentoId: "l2", vencimento: "2026-03-07" })], cliente(), "2026-03-10");

  function registroEmMemoria() {
    const linhas = new Map<string, { ok: boolean | null; erro?: string; modo: string }>();
    const registro: RegistroLembretes = {
      async reservar(_c, itens, canal, hoje, modo) {
        const novos = itens.filter((i) => !linhas.has(`${i.lancamentoId}|${canal}|${hoje}`));
        for (const i of novos) linhas.set(`${i.lancamentoId}|${canal}|${hoje}`, { ok: null, modo });
        return novos.map((i) => i.lancamentoId);
      },
      async concluir(ids, canal, hoje, ok, erro) {
        for (const id of ids) linhas.set(`${id}|${canal}|${hoje}`, { ...linhas.get(`${id}|${canal}|${hoje}`)!, ok, erro });
      },
    };
    return { linhas, registro };
  }

  const canalFalso = (canal: "email" | "whatsapp", resultado: { ok: boolean; erro?: string }, envios: string[]): CanalEnvio => ({
    canal,
    modo: "real",
    async enviar(g) {
      envios.push(`${canal}:${g.itens.map((i) => i.lancamentoId).join(",")}`);
      return resultado;
    },
  });

  it("um lembrete por canal com todas as cobranças, registrando cada envio", async () => {
    const { linhas, registro } = registroEmMemoria();
    const envios: string[] = [];
    const r = await enviarLembretes(grupos, [canalFalso("email", { ok: true }, envios)], new Set(), pagamento, "2026-03-10", registro);
    expect(envios).toEqual(["email:l1,l2"]);
    expect(r).toMatchObject({ lembretes: 1, cobrancas: 2, falhas: 0 });
    expect([...linhas.values()].every((l) => l.ok === true && l.modo === "real")).toBe(true);
  });

  it("nunca envia o mesmo lembrete duas vezes no mesmo dia", async () => {
    const { registro } = registroEmMemoria();
    const envios: string[] = [];
    const canal = canalFalso("email", { ok: true }, envios);
    await enviarLembretes(grupos, [canal], new Set(), pagamento, "2026-03-10", registro);
    await enviarLembretes(grupos, [canal], new Set(), pagamento, "2026-03-10", registro); // rotina rodou de novo
    await enviarLembretes(grupos, [canal], new Set(["l1|email", "l2|email"]), pagamento, "2026-03-10", registro);
    expect(envios).toEqual(["email:l1,l2"]);
  });

  it("se um canal falha, o outro continua; a falha fica registrada", async () => {
    const { linhas, registro } = registroEmMemoria();
    const envios: string[] = [];
    const r = await enviarLembretes(
      grupos,
      [canalFalso("whatsapp", { ok: false, erro: "número inválido" }, envios), canalFalso("email", { ok: true }, envios)],
      new Set(),
      pagamento,
      "2026-03-10",
      registro,
    );
    expect(envios).toEqual(["whatsapp:l1,l2", "email:l1,l2"]);
    expect(r).toMatchObject({ lembretes: 1, falhas: 1 });
    expect(linhas.get("l1|whatsapp|2026-03-10")).toMatchObject({ ok: false, erro: "número inválido" });
    expect(linhas.get("l1|email|2026-03-10")).toMatchObject({ ok: true });
  });

  it("erro inesperado no envio também é registrado como falha", async () => {
    const { linhas, registro } = registroEmMemoria();
    const quebrado: CanalEnvio = { canal: "email", modo: "real", enviar: async () => { throw new Error("rede fora"); } };
    const r = await enviarLembretes(grupos, [quebrado], new Set(), pagamento, "2026-03-10", registro);
    expect(r.falhas).toBe(1);
    expect(linhas.get("l2|email|2026-03-10")).toMatchObject({ ok: false, erro: "rede fora" });
  });
});

describe("modo de envio", () => {
  it("em desenvolvimento nunca envia de verdade (só registra)", () => {
    expect(canaisAtivos({ NODE_ENV: "development", LEMBRETES_MODO: "real" }).map((c) => c.modo)).toEqual(["log"]);
    expect(canaisAtivos({ NODE_ENV: "production" }).map((c) => c.modo)).toEqual(["log"]);
  });

  it("em produção com LEMBRETES_MODO=real usa o e-mail e exige as configurações", () => {
    expect(() => canaisAtivos({ NODE_ENV: "production", LEMBRETES_MODO: "real" })).toThrow(/RESEND_API_KEY/);
    const canais = canaisAtivos({
      NODE_ENV: "production",
      LEMBRETES_MODO: "real",
      RESEND_API_KEY: "re_x",
      EMAIL_REMETENTE: "contato@movcode.com.br",
      PAGAMENTO_PIX_CHAVE: "x",
      PAGAMENTO_PIX_NOME: "y",
    });
    expect(canais.map((c) => [c.canal, c.modo])).toEqual([["email", "real"]]);
  });

  it("chama a API do Resend com remetente, resposta e chave de idempotência", async () => {
    let pedido: { url: string; init: RequestInit } | null = null;
    const buscar = (async (url: string, init: RequestInit) => {
      pedido = { url, init };
      return new Response(JSON.stringify({ id: "1" }));
    }) as unknown as typeof fetch;
    const canal = canalEmailResend({ apiKey: "re_x", remetente: "contato@movcode.com.br", responderPara: "contato@movcode.com.br", buscar });
    const grupo = { cliente: cliente(), itens: [{ lancamentoId: "l1", produto: "Site", valor: 1, vencimento: "2026-03-10", diasAtraso: 0 }] };
    expect(await canal.enviar(grupo, { assunto: "A", texto: "T", html: "H" }, "chave-1")).toEqual({ ok: true });
    const corpo = JSON.parse(String(pedido!.init.body));
    expect(pedido!.url).toBe("https://api.resend.com/emails");
    expect((pedido!.init.headers as Record<string, string>)["Idempotency-Key"]).toBe("chave-1");
    expect(corpo).toMatchObject({ from: "Mov Code <contato@movcode.com.br>", to: ["joao@padaria.com.br"], reply_to: "contato@movcode.com.br", subject: "A" });

    const recusa = canalEmailResend({ apiKey: "x", remetente: "a@b.c", responderPara: "a@b.c", buscar: (async () => new Response("domínio não verificado", { status: 403 })) as unknown as typeof fetch });
    expect(await recusa.enviar(grupo, { assunto: "A", texto: "T", html: "H" }, "k")).toEqual({ ok: false, erro: "Resend 403: domínio não verificado" });
  });
});
