import { z } from "zod";

/**
 * Prospecção ativa pelo Instagram: o funil dos leads, o calendário dos
 * follow-ups e a leitura dos leads que chegam da rotina de busca (ou do
 * painel antigo "Prospecção MovCode", no formato dele).
 */

export const ETAPAS = {
  novo: "Novo",
  abordado: "Abordado",
  respondeu: "Respondeu",
  reuniao: "Reunião",
  proposta: "Proposta",
  fechado: "Fechado",
  perdido: "Perdido",
} as const;
export type Etapa = keyof typeof ETAPAS;
export const LISTA_ETAPAS = Object.keys(ETAPAS) as Etapa[];

/** Nome de cada etapa no funil (contagem). */
export const ETAPAS_FUNIL: Record<Etapa, string> = {
  novo: "Novos",
  abordado: "Abordados",
  respondeu: "Responderam",
  reuniao: "Reunião",
  proposta: "Proposta",
  fechado: "Fechados",
  perdido: "Perdidos",
};

/** Dias até o 1º follow-up, do 1º até o 2º, e do 2º até sugerir "Perdido". */
export const DIAS_FOLLOWUP = [3, 4, 5] as const;
export const MAXIMO_FOLLOWUPS = 2;

/** "@Negocio", "instagram.com/negocio/" ou "negocio" → "negocio". */
export function normalizarInstagram(texto: string): string {
  return texto
    .trim()
    .replace(/^@/, "")
    .replace(/^(https?:\/\/)?(www\.)?instagram\.com\//i, "")
    .replace(/[/?#].*$/, "")
    .toLowerCase();
}

/** Regras do Instagram: até 30 letras, números, ponto ou sublinhado. */
export function instagramValido(texto: string): boolean {
  return /^[a-z0-9._]{1,30}$/.test(texto);
}

export function urlInstagram(instagram: string): string {
  return `https://www.instagram.com/${encodeURIComponent(instagram)}/`;
}

/** Só aceita endereços http(s); qualquer outra coisa (como "javascript:") vira vazio. */
export function urlSegura(texto: string): string {
  const url = texto.trim();
  if (!/^https?:\/\//i.test(url)) return "";
  try {
    new URL(url);
    return url;
  } catch {
    return "";
  }
}

export function somarDias(agora: Date, dias: number): string {
  return new Date(agora.getTime() + dias * 86_400_000).toISOString();
}

/** Faixa da nota, para a cor: 75+ alta, 55+ média, abaixo disso baixa. */
export function faixaDaNota(nota: number): "alta" | "media" | "baixa" {
  return nota >= 75 ? "alta" : nota >= 55 ? "media" : "baixa";
}

// ---------------------------------------------------------------------
// Andamento do lead
// ---------------------------------------------------------------------

export type Andamento = {
  etapa: Etapa;
  proximoFollowup: string | null;
  followupsEnviados: number;
  abordadoEm: string | null;
  respondeuEm: string | null;
  responsavelId: string | null;
};

/** Abordado sem resposta e já passou da data de cobrar. */
export function followupVencido(lead: Pick<Andamento, "etapa" | "proximoFollowup">, agora: Date): boolean {
  return lead.etapa === "abordado" && lead.proximoFollowup !== null && new Date(lead.proximoFollowup) <= agora;
}

/** Já mandou os 2 follow-ups e o prazo do último passou: vale mover para Perdido. */
export function semResposta(lead: Pick<Andamento, "etapa" | "proximoFollowup" | "followupsEnviados">, agora: Date) {
  return followupVencido(lead, agora) && lead.followupsEnviados >= MAXIMO_FOLLOWUPS;
}

export const CAMPOS_TEXTO = {
  mensagem: "Mensagem de abertura",
  followup1: "Follow-up 1",
  followup2: "Follow-up 2",
  resposta_sim: "Resposta: valores + link da prévia",
} as const;
export type CampoTexto = keyof typeof CAMPOS_TEXTO;

/** Qual texto mostrar para copiar agora, conforme a etapa e os follow-ups. */
export function textoDaVez(lead: Pick<Andamento, "etapa" | "proximoFollowup" | "followupsEnviados">, agora: Date): CampoTexto {
  if (lead.etapa === "respondeu") return "resposta_sim";
  if (followupVencido(lead, agora) && lead.followupsEnviados < MAXIMO_FOLLOWUPS) {
    return lead.followupsEnviados === 0 ? "followup1" : "followup2";
  }
  return "mensagem";
}

export const ACOES = {
  mensagem_enviada: "Enviei a mensagem",
  followup_enviado: "Enviei o follow-up",
  quer_previa: "Respondeu: quer ver a prévia",
} as const;
export type AcaoLead = keyof typeof ACOES;

/** Ações disponíveis agora; a primeira é a principal. */
export function acoesDaVez(lead: Pick<Andamento, "etapa" | "proximoFollowup" | "followupsEnviados">, agora: Date): AcaoLead[] {
  if (lead.etapa === "novo") return ["mensagem_enviada"];
  if (lead.etapa !== "abordado") return [];
  return followupVencido(lead, agora) && lead.followupsEnviados < MAXIMO_FOLLOWUPS
    ? ["followup_enviado", "quer_previa"]
    : ["quer_previa"];
}

/**
 * O que muda no lead ao registrar uma ação (nomes das colunas do banco).
 * Devolve null se a ação não vale mais (tela desatualizada, clique repetido).
 */
export function aplicarAcao(acao: AcaoLead, lead: Andamento, usuarioId: string, agora: Date): Record<string, unknown> | null {
  if (!acoesDaVez(lead, agora).includes(acao)) return null;
  const agoraIso = agora.toISOString();
  switch (acao) {
    case "mensagem_enviada":
      return {
        etapa: "abordado",
        abordado_em: agoraIso,
        proximo_followup: somarDias(agora, DIAS_FOLLOWUP[0]),
        followups_enviados: 0,
        responsavel_id: lead.responsavelId ?? usuarioId,
      };
    case "followup_enviado": {
      const enviados = lead.followupsEnviados + 1;
      return {
        followups_enviados: enviados,
        proximo_followup: somarDias(agora, DIAS_FOLLOWUP[enviados]),
        ultimo_followup_em: agoraIso,
      };
    }
    case "quer_previa":
      return { etapa: "respondeu", respondeu_em: agoraIso };
  }
}

/** Troca de etapa à mão: a 1ª vez em "Abordado" já agenda o follow-up. */
export function mudarEtapa(lead: Andamento, nova: Etapa, agora: Date): Record<string, unknown> {
  const mudancas: Record<string, unknown> = { etapa: nova };
  if (nova === "abordado" && !lead.abordadoEm) {
    Object.assign(mudancas, {
      abordado_em: agora.toISOString(),
      proximo_followup: somarDias(agora, DIAS_FOLLOWUP[0]),
      followups_enviados: 0,
    });
  }
  if (nova === "respondeu" && !lead.respondeuEm) mudancas.respondeu_em = agora.toISOString();
  return mudancas;
}

// ---------------------------------------------------------------------
// Formulários
// ---------------------------------------------------------------------

const campoInstagram = z
  .string()
  .transform(normalizarInstagram)
  .refine(instagramValido, "Informe o @ do Instagram (letras, números, ponto ou _).");

export const esquemaLeadManual = z.object({
  instagram: campoInstagram,
  nome: z.string().trim().min(1, "Informe o nome do negócio.").max(150, "Nome muito longo."),
  nicho: z.string().trim().max(80, "Nicho muito longo."),
});

const linhas = (rotulo: string) =>
  z
    .string()
    .transform((texto) => [...new Set(texto.split("\n").map((l) => l.trim()).filter(Boolean))])
    .refine((lista) => lista.length >= 1, `Informe ao menos ${rotulo}.`)
    .refine((lista) => lista.length <= 30 && lista.every((l) => l.length <= 80), "Lista muito longa.");

export const esquemaConfiguracao = z.object({
  cidades: linhas("uma cidade"),
  nichos: linhas("um nicho"),
  leads_por_dia: z.coerce.number().int("Use um número inteiro.").min(1, "Mínimo 1.").max(30, "Máximo 30."),
  assinatura: z.string().trim().max(100, "Assinatura muito longa."),
  instrucoes: z.string().trim().max(5000, "Texto muito longo."),
});

// ---------------------------------------------------------------------
// Leads que chegam de fora: rotina de busca e painel antigo
// (mesmos nomes de campo do painel "Prospecção MovCode")
// ---------------------------------------------------------------------

const texto = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Texto com mais de ${max} caracteres.`)
    .nullish()
    .transform((v) => v ?? "");
const endereco = z
  .string()
  .max(500)
  .nullish()
  .transform((v) => urlSegura(v ?? ""));
const momento = z
  .string()
  .refine((v) => !Number.isNaN(Date.parse(v)), "Data inválida.")
  .nullish()
  .transform((v) => (v ? new Date(v).toISOString() : null));

export const esquemaLeadExterno = z.object({
  instagram: campoInstagram,
  nome: z.string().trim().min(1, "Falta o nome.").max(150, "Nome muito longo."),
  nicho: texto(80),
  cidade: texto(80),
  score: z.coerce.number().int().min(0).max(100).nullish().transform((v) => v ?? 60),
  siteStatus: texto(120),
  siteUrl: endereco,
  linkPrevia: endereco,
  whatsapp: texto(40),
  motivo: texto(1000),
  dor: texto(1000),
  servico: texto(1000),
  mensagem: texto(3000),
  followup1: texto(3000),
  followup2: texto(3000),
  respostaSim: texto(3000),
  fonte: texto(300),
  perfilConferido: z.boolean().nullish().transform((v) => v ?? false),
  criadoEm: momento,
  // Andamento: só vale na importação do painel antigo
  status: z.enum(LISTA_ETAPAS).nullish().transform((v) => v ?? "novo"),
  abordadoEm: momento,
  proximoFollowup: momento,
  followupsEnviados: z.coerce.number().int().min(0).max(MAXIMO_FOLLOWUPS).nullish().transform((v) => v ?? 0),
  ultimoFollowupEm: momento,
  respondeuEm: momento,
  notas: texto(5000),
});
export type LeadExterno = z.infer<typeof esquemaLeadExterno>;

/** Converte para as colunas da tabela leads. A rotina só cria leads novos, sem andamento. */
export function linhaDoLead(lead: LeadExterno, opcoes: { manterAndamento: boolean; agora: Date }) {
  const linha = {
    instagram: lead.instagram,
    nome: lead.nome,
    nicho: lead.nicho,
    cidade: lead.cidade,
    nota: lead.score,
    site_situacao: lead.siteStatus,
    site_url: lead.siteUrl,
    link_previa: lead.linkPrevia,
    whatsapp: lead.whatsapp,
    motivo: lead.motivo,
    dor: lead.dor,
    servico: lead.servico,
    mensagem: lead.mensagem,
    followup1: lead.followup1,
    followup2: lead.followup2,
    resposta_sim: lead.respostaSim,
    fonte: lead.fonte,
    perfil_conferido: lead.perfilConferido,
    encontrado_em: lead.criadoEm ?? opcoes.agora.toISOString(),
    etapa: "novo" as Etapa,
  };
  if (!opcoes.manterAndamento) return linha;
  return {
    ...linha,
    etapa: lead.status,
    abordado_em: lead.abordadoEm,
    proximo_followup: lead.proximoFollowup,
    followups_enviados: lead.followupsEnviados,
    ultimo_followup_em: lead.ultimoFollowupEm,
    respondeu_em: lead.respondeuEm,
    notas: lead.notas,
  };
}
export type LinhaLead = ReturnType<typeof linhaDoLead>;

export type LeadsLidos = { linhas: LinhaLead[]; invalidos: { posicao: number; instagram: string; erro: string }[] };

/** Valida uma lista de leads; os inválidos voltam com o motivo, os demais seguem. */
export function lerLeads(lista: unknown, opcoes: { manterAndamento: boolean; agora: Date }): LeadsLidos {
  const resultado: LeadsLidos = { linhas: [], invalidos: [] };
  if (!Array.isArray(lista)) return resultado;
  const vistos = new Set<string>();
  lista.forEach((item, i) => {
    const lido = esquemaLeadExterno.safeParse(item);
    const instagram = String((item as { instagram?: unknown })?.instagram ?? "");
    if (!lido.success) {
      const problema = lido.error.issues[0];
      resultado.invalidos.push({ posicao: i + 1, instagram, erro: `${problema.path.join(".")}: ${problema.message}` });
    } else if (vistos.has(lido.data.instagram)) {
      resultado.invalidos.push({ posicao: i + 1, instagram, erro: "@ repetido na lista." });
    } else {
      vistos.add(lido.data.instagram);
      resultado.linhas.push(linhaDoLead(lido.data, opcoes));
    }
  });
  return resultado;
}

/** Marca do arquivo exportado do painel antigo. */
export const ORIGEM_PAINEL = "painel-prospeccao-movcode";

const esquemaConfigPainel = z.object({
  cidades: z.array(z.string().trim().min(1).max(80)).max(30),
  nichos: z.array(z.string().trim().min(1).max(80)).max(30),
  leadsPorDia: z.coerce.number().int().min(1).max(30),
  assinatura: texto(100),
  extra: texto(5000),
  ultimaRodada: momento,
  adicionados: z.coerce.number().int().min(0).nullish(),
});

/** Lê o arquivo exportado do painel antigo: os leads (com andamento) e a configuração. */
export function lerExportacaoPainel(conteudo: string, agora: Date) {
  let dados: { origem?: unknown; leads?: unknown; config?: unknown };
  try {
    dados = JSON.parse(conteudo);
  } catch {
    throw new Error("O arquivo não é um JSON válido.");
  }
  if (dados?.origem !== ORIGEM_PAINEL || !Array.isArray(dados.leads)) {
    throw new Error("O arquivo não é uma exportação do painel de prospecção.");
  }
  const config = esquemaConfigPainel.safeParse(dados.config);
  return {
    ...lerLeads(dados.leads, { manterAndamento: true, agora }),
    config: config.success
      ? {
          cidades: config.data.cidades,
          nichos: config.data.nichos,
          leads_por_dia: config.data.leadsPorDia,
          assinatura: config.data.assinatura,
          instrucoes: config.data.extra,
          ultima_busca_em: config.data.ultimaRodada,
          ultima_busca_adicionados: config.data.adicionados ?? null,
        }
      : null,
  };
}
