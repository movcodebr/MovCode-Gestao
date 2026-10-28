import { describe, expect, it } from "vitest";
import {
  acoesDaVez,
  type Andamento,
  aplicarAcao,
  esquemaConfiguracao,
  esquemaLeadManual,
  faixaDaNota,
  followupVencido,
  instagramValido,
  lerExportacaoPainel,
  lerLeads,
  mudarEtapa,
  normalizarInstagram,
  ORIGEM_PAINEL,
  semResposta,
  textoDaVez,
  urlSegura,
} from "@/lib/dominio/prospeccao";

const AGORA = new Date("2026-10-28T12:00:00.000Z");
const DIA = 86_400_000;
const depois = (dias: number) => new Date(AGORA.getTime() + dias * DIA).toISOString();

function lead(extra: Partial<Andamento> = {}): Andamento {
  return {
    etapa: "novo",
    proximoFollowup: null,
    followupsEnviados: 0,
    abordadoEm: null,
    respondeuEm: null,
    responsavelId: null,
    ...extra,
  };
}

describe("@ do Instagram", () => {
  it("normaliza @, endereço do perfil e maiúsculas", () => {
    expect(normalizarInstagram(" @Pet.Shop_RP ")).toBe("pet.shop_rp");
    expect(normalizarInstagram("https://www.instagram.com/barbearia777/?hl=pt")).toBe("barbearia777");
    expect(normalizarInstagram("instagram.com/cao_kilate")).toBe("cao_kilate");
  });

  it("aceita só letras, números, ponto e _ (até 30)", () => {
    expect(instagramValido("adega_zero16")).toBe(true);
    expect(instagramValido("")).toBe(false);
    expect(instagramValido("com espaço")).toBe(false);
    expect(instagramValido("a".repeat(31))).toBe(false);
  });
});

describe("endereços", () => {
  it("só aceita http(s): links perigosos viram vazio", () => {
    expect(urlSegura(" https://movcode.com.br/sua-pagina?nome=X ")).toBe("https://movcode.com.br/sua-pagina?nome=X");
    expect(urlSegura("javascript:alert(1)")).toBe("");
    expect(urlSegura("movcode.com.br")).toBe("");
    expect(urlSegura("https://")).toBe("");
  });
});

describe("nota do lead", () => {
  it("75+ é alta, 55+ média, abaixo disso baixa", () => {
    expect([faixaDaNota(75), faixaDaNota(74), faixaDaNota(55), faixaDaNota(54)]).toEqual(["alta", "media", "media", "baixa"]);
  });
});

describe("calendário dos follow-ups", () => {
  it("enviar a mensagem leva para Abordado, agenda o 1º follow-up em 3 dias e assume o lead", () => {
    const m = aplicarAcao("mensagem_enviada", lead(), "eu", AGORA);
    expect(m).toEqual({
      etapa: "abordado",
      abordado_em: AGORA.toISOString(),
      proximo_followup: depois(3),
      followups_enviados: 0,
      responsavel_id: "eu",
    });
  });

  it("não troca o responsável que já existia", () => {
    expect(aplicarAcao("mensagem_enviada", lead({ responsavelId: "socio" }), "eu", AGORA)).toMatchObject({
      responsavel_id: "socio",
    });
  });

  it("o follow-up só vence na data marcada", () => {
    const abordado = lead({ etapa: "abordado", proximoFollowup: depois(1) });
    expect(followupVencido(abordado, AGORA)).toBe(false);
    expect(followupVencido({ ...abordado, proximoFollowup: AGORA.toISOString() }, AGORA)).toBe(true);
    expect(followupVencido({ ...abordado, etapa: "respondeu", proximoFollowup: depois(-1) }, AGORA)).toBe(false);
  });

  it("1º follow-up agenda o 2º em 4 dias; o 2º espera mais 5 dias", () => {
    const vencido = lead({ etapa: "abordado", proximoFollowup: depois(-1) });
    expect(aplicarAcao("followup_enviado", vencido, "eu", AGORA)).toEqual({
      followups_enviados: 1,
      proximo_followup: depois(4),
      ultimo_followup_em: AGORA.toISOString(),
    });
    expect(aplicarAcao("followup_enviado", { ...vencido, followupsEnviados: 1 }, "eu", AGORA)).toMatchObject({
      followups_enviados: 2,
      proximo_followup: depois(5),
    });
  });

  it("depois de 2 follow-ups sem resposta, sugere Perdido e não oferece um 3º", () => {
    const esgotado = lead({ etapa: "abordado", proximoFollowup: depois(-1), followupsEnviados: 2 });
    expect(semResposta(esgotado, AGORA)).toBe(true);
    expect(acoesDaVez(esgotado, AGORA)).toEqual(["quer_previa"]);
    expect(aplicarAcao("followup_enviado", esgotado, "eu", AGORA)).toBeNull();
  });

  it("não registra a mesma ação duas vezes (tela desatualizada ou clique repetido)", () => {
    const aguardando = lead({ etapa: "abordado", proximoFollowup: depois(2) });
    expect(aplicarAcao("mensagem_enviada", aguardando, "eu", AGORA)).toBeNull();
    expect(aplicarAcao("followup_enviado", aguardando, "eu", AGORA)).toBeNull();
  });
});

describe("texto e ações da vez", () => {
  it("novo: mensagem de abertura e 'Enviei a mensagem'", () => {
    expect(textoDaVez(lead(), AGORA)).toBe("mensagem");
    expect(acoesDaVez(lead(), AGORA)).toEqual(["mensagem_enviada"]);
  });

  it("follow-up vencido: o texto do follow-up certo, e quem respondeu também pode ser marcado", () => {
    const vencido = lead({ etapa: "abordado", proximoFollowup: depois(-1) });
    expect(textoDaVez(vencido, AGORA)).toBe("followup1");
    expect(textoDaVez({ ...vencido, followupsEnviados: 1 }, AGORA)).toBe("followup2");
    expect(acoesDaVez(vencido, AGORA)).toEqual(["followup_enviado", "quer_previa"]);
  });

  it("respondeu: resposta com valores e link da prévia; as demais etapas não têm ação", () => {
    expect(textoDaVez(lead({ etapa: "respondeu" }), AGORA)).toBe("resposta_sim");
    expect(aplicarAcao("quer_previa", lead({ etapa: "abordado", proximoFollowup: depois(2) }), "eu", AGORA)).toEqual({
      etapa: "respondeu",
      respondeu_em: AGORA.toISOString(),
    });
    for (const etapa of ["respondeu", "reuniao", "proposta", "fechado", "perdido"] as const) {
      expect(acoesDaVez(lead({ etapa }), AGORA)).toEqual([]);
    }
  });
});

describe("troca de etapa à mão", () => {
  it("a 1ª vez em Abordado agenda o follow-up; depois não reinicia a contagem", () => {
    expect(mudarEtapa(lead(), "abordado", AGORA)).toEqual({
      etapa: "abordado",
      abordado_em: AGORA.toISOString(),
      proximo_followup: depois(3),
      followups_enviados: 0,
    });
    expect(mudarEtapa(lead({ abordadoEm: depois(-5) }), "abordado", AGORA)).toEqual({ etapa: "abordado" });
  });

  it("guarda quando o lead respondeu", () => {
    expect(mudarEtapa(lead(), "respondeu", AGORA)).toEqual({ etapa: "respondeu", respondeu_em: AGORA.toISOString() });
    expect(mudarEtapa(lead(), "perdido", AGORA)).toEqual({ etapa: "perdido" });
  });
});

describe("formulários", () => {
  it("lead manual: normaliza o @ e exige nome", () => {
    expect(esquemaLeadManual.parse({ instagram: "@Negocio.RP", nome: " Negócio ", nicho: "pet shop" })).toEqual({
      instagram: "negocio.rp",
      nome: "Negócio",
      nicho: "pet shop",
    });
    const r = esquemaLeadManual.safeParse({ instagram: "@ x", nome: " ", nicho: "" });
    expect(r.error?.issues.map((i) => i.path[0])).toEqual(expect.arrayContaining(["instagram", "nome"]));
  });

  it("configuração: uma cidade/nicho por linha, sem repetir, e de 1 a 30 leads por dia", () => {
    expect(
      esquemaConfiguracao.parse({
        cidades: "Ribeirão Preto\n\n Sertãozinho \nRibeirão Preto",
        nichos: "barbearia",
        leads_por_dia: "8",
        assinatura: "Kaique",
        instrucoes: "",
      }),
    ).toEqual({ cidades: ["Ribeirão Preto", "Sertãozinho"], nichos: ["barbearia"], leads_por_dia: 8, assinatura: "Kaique", instrucoes: "" });
    const r = esquemaConfiguracao.safeParse({ cidades: " ", nichos: "x", leads_por_dia: "31", assinatura: "", instrucoes: "" });
    expect(r.error?.issues.map((i) => i.path[0])).toEqual(expect.arrayContaining(["cidades", "leads_por_dia"]));
  });
});

describe("leads que chegam da busca diária", () => {
  const encontrado = {
    instagram: "@Adega_Zero16",
    nome: "Adega Zero16",
    nicho: "depósito de bebidas",
    cidade: "Ribeirão Preto",
    score: 76,
    siteStatus: "sem site encontrado",
    siteUrl: "",
    linkPrevia: "https://movcode.com.br/sua-pagina?nome=Adega%20Zero16&nicho=outro",
    whatsapp: "",
    motivo: "Adega na Av. Dom Pedro I.",
    mensagem: "Olá, tudo bem?",
    followup1: "Oi!",
    followup2: "Tchau!",
    respostaSim: "Que bom!",
    fonte: "busca web: instagram adega",
    perfilConferido: false,
    criadoEm: "2026-10-02T11:51:21.000Z",
    status: "abordado",
    abordadoEm: "2026-10-03T10:00:00Z",
  };

  it("viram leads novos com os nomes de coluna do banco (a busca nunca traz andamento)", () => {
    const { linhas, invalidos } = lerLeads([encontrado], { manterAndamento: false, agora: AGORA });
    expect(invalidos).toEqual([]);
    expect(linhas).toEqual([
      {
        instagram: "adega_zero16",
        nome: "Adega Zero16",
        nicho: "depósito de bebidas",
        cidade: "Ribeirão Preto",
        nota: 76,
        site_situacao: "sem site encontrado",
        site_url: "",
        link_previa: "https://movcode.com.br/sua-pagina?nome=Adega%20Zero16&nicho=outro",
        whatsapp: "",
        motivo: "Adega na Av. Dom Pedro I.",
        dor: "",
        servico: "",
        mensagem: "Olá, tudo bem?",
        followup1: "Oi!",
        followup2: "Tchau!",
        resposta_sim: "Que bom!",
        fonte: "busca web: instagram adega",
        perfil_conferido: false,
        encontrado_em: "2026-10-02T11:51:21.000Z",
        etapa: "novo",
      },
    ]);
  });

  it("separa os inválidos e os repetidos, com o motivo, e grava o resto", () => {
    const { linhas, invalidos } = lerLeads(
      [encontrado, { ...encontrado, nome: "Outro" }, { instagram: "sem nome" }, { instagram: "ok", nome: "Ok", siteUrl: "javascript:x" }],
      { manterAndamento: false, agora: AGORA },
    );
    expect(linhas.map((l) => l.instagram)).toEqual(["adega_zero16", "ok"]);
    expect(linhas[1]).toMatchObject({ site_url: "", nota: 60, encontrado_em: AGORA.toISOString() });
    expect(invalidos.map((i) => i.posicao)).toEqual([2, 3]);
    expect(invalidos[0].erro).toMatch(/repetido/);
  });

  it("lista que não é lista não grava nada", () => {
    expect(lerLeads({ leads: [] }, { manterAndamento: false, agora: AGORA })).toEqual({ linhas: [], invalidos: [] });
  });
});

describe("importação do painel antigo", () => {
  const arquivo = {
    origem: ORIGEM_PAINEL,
    config: {
      cidades: ["Ribeirão Preto"],
      nichos: ["barbearia", "pet shop"],
      leadsPorDia: 8,
      assinatura: "Kaique, da MovCode",
      extra: "FOCO ATUAL: landing pages.",
      ultimaRodada: "2026-10-27T12:01:47Z",
      adicionados: 4,
    },
    leads: [
      {
        instagram: "riberbrejas",
        nome: "Riber Brejas",
        status: "abordado",
        abordadoEm: "2026-10-10T18:43:25.366Z",
        proximoFollowup: "2026-10-13T18:43:25.366Z",
        followupsEnviados: 1,
        notas: "Pediu o preço",
      },
    ],
  };

  it("mantém o andamento dos leads e traz a configuração", () => {
    const r = lerExportacaoPainel(JSON.stringify(arquivo), AGORA);
    expect(r.linhas[0]).toMatchObject({
      instagram: "riberbrejas",
      etapa: "abordado",
      abordado_em: "2026-10-10T18:43:25.366Z",
      proximo_followup: "2026-10-13T18:43:25.366Z",
      followups_enviados: 1,
      notas: "Pediu o preço",
    });
    expect(r.config).toEqual({
      cidades: ["Ribeirão Preto"],
      nichos: ["barbearia", "pet shop"],
      leads_por_dia: 8,
      assinatura: "Kaique, da MovCode",
      instrucoes: "FOCO ATUAL: landing pages.",
      ultima_busca_em: "2026-10-27T12:01:47.000Z",
      ultima_busca_adicionados: 4,
    });
  });

  it("recusa arquivo que não é do painel", () => {
    expect(() => lerExportacaoPainel("não é json", AGORA)).toThrow(/JSON válido/);
    expect(() => lerExportacaoPainel(JSON.stringify({ leads: [] }), AGORA)).toThrow(/exportação do painel/);
  });
});
