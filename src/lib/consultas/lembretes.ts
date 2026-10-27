import "server-only";
import { hojeEmBrasilia, somarDias } from "@/lib/dominio/datas";
import type { criarClienteSupabase } from "@/lib/supabase/servidor";

type Supabase = Awaited<ReturnType<typeof criarClienteSupabase>>;

export type PausaHistorico = {
  id: string;
  inicio: string;
  fim: string;
  motivo: string | null;
  pausadoPor: string;
  retomadoEm: string | null;
  retomadoPor: string | null;
  vigente: boolean;
};

export type EnvioHistorico = {
  data: string;
  canal: string;
  cobrancas: number;
  sucesso: boolean;
  erro: string | null;
  modo: string;
  maiorAtraso: number;
};

async function nomesUsuarios(supabase: Supabase): Promise<Map<string, string>> {
  const { data } = await supabase.from("usuarios").select("id, nome");
  return new Map((data ?? []).map((u) => [u.id, u.nome]));
}

/** Pausas e lembretes enviados de um cliente. */
export async function lembretesDoCliente(supabase: Supabase, clienteId: string) {
  const hoje = hojeEmBrasilia();
  const [{ data: pausas }, { data: envios }, usuarios] = await Promise.all([
    supabase.from("pausas_lembrete").select("*").eq("cliente_id", clienteId).order("criado_em", { ascending: false }),
    supabase
      .from("lembretes_enviados")
      .select("data_referencia, canal, sucesso, erro, modo, dias_atraso")
      .eq("cliente_id", clienteId)
      .order("data_referencia", { ascending: false })
      .limit(200),
    nomesUsuarios(supabase),
  ]);

  const historicoPausas: PausaHistorico[] = (pausas ?? []).map((p) => ({
    id: p.id,
    inicio: p.inicio,
    fim: p.fim,
    motivo: p.motivo,
    pausadoPor: usuarios.get(p.criado_por) ?? "usuário",
    retomadoEm: p.retomado_em,
    retomadoPor: p.retomado_por ? (usuarios.get(p.retomado_por) ?? "usuário") : null,
    vigente: p.inicio <= hoje && hoje < (p.retomado_em ?? p.fim),
  }));

  // Um lembrete = um envio por dia e canal (pode listar várias cobranças)
  const porEnvio = new Map<string, EnvioHistorico>();
  for (const e of envios ?? []) {
    const chave = `${e.data_referencia}|${e.canal}`;
    const atual = porEnvio.get(chave);
    if (atual) {
      atual.cobrancas++;
      atual.maiorAtraso = Math.max(atual.maiorAtraso, e.dias_atraso);
    } else {
      porEnvio.set(chave, {
        data: e.data_referencia,
        canal: e.canal,
        cobrancas: 1,
        sucesso: e.sucesso,
        erro: e.erro,
        modo: e.modo,
        maiorAtraso: e.dias_atraso,
      });
    }
  }
  return { pausas: historicoPausas, envios: [...porEnvio.values()] };
}

/** Para o dashboard: falhas de envio dos últimos 30 dias e clientes com lembretes pausados. */
export async function resumoLembretes(supabase: Supabase) {
  const hoje = hojeEmBrasilia();
  const [{ data: falhas }, { data: pausados }, { data: clientes }] = await Promise.all([
    supabase
      .from("lembretes_enviados")
      .select("cliente_id, data_referencia, canal, erro")
      .eq("sucesso", false)
      .gte("data_referencia", somarDias(hoje, -30))
      .order("data_referencia", { ascending: false }),
    supabase.from("v_clientes").select("id, nome, lembretes_pausados_ate").not("lembretes_pausados_ate", "is", null),
    supabase.from("clientes").select("id, nome"),
  ]);
  const nome = new Map((clientes ?? []).map((c) => [c.id, c.nome]));

  const falhasPorEnvio = new Map<string, { clienteId: string; cliente: string; data: string; canal: string; erro: string; cobrancas: number }>();
  for (const f of falhas ?? []) {
    const chave = `${f.cliente_id}|${f.data_referencia}|${f.canal}`;
    const atual = falhasPorEnvio.get(chave);
    if (atual) atual.cobrancas++;
    else
      falhasPorEnvio.set(chave, {
        clienteId: f.cliente_id,
        cliente: nome.get(f.cliente_id) ?? "Cliente",
        data: f.data_referencia,
        canal: f.canal,
        erro: f.erro ?? "falha sem detalhe",
        cobrancas: 1,
      });
  }

  const { data: motivos } = pausados?.length
    ? await supabase
        .from("pausas_lembrete")
        .select("cliente_id, motivo, fim, retomado_em, inicio")
        .in("cliente_id", pausados.map((p) => p.id))
    : { data: [] };

  return {
    falhas: [...falhasPorEnvio.values()],
    pausados: (pausados ?? []).map((p) => ({
      clienteId: p.id,
      cliente: p.nome,
      ate: p.lembretes_pausados_ate as string,
      motivo:
        (motivos ?? []).find((m) => m.cliente_id === p.id && m.fim === p.lembretes_pausados_ate && !m.retomado_em)?.motivo ?? null,
    })),
  };
}
