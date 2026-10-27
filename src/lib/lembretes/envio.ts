import type { DataISO } from "@/lib/dominio/datas";
import { type Canal, type GrupoLembrete, type ItemLembrete, semJaEnviados } from "@/lib/dominio/lembretes";
import type { CanalEnvio } from "./canais";
import { type DadosPagamento, montarMensagem } from "./mensagens";

/** Onde os envios são registrados (tabela lembretes_enviados). */
export type RegistroLembretes = {
  /**
   * Reserva o envio de cada cobrança no canal e dia. Devolve só as que foram reservadas agora
   * (as que já tinham registro são ignoradas — isso impede envio duplicado mesmo em paralelo).
   */
  reservar(clienteId: string, itens: ItemLembrete[], canal: Canal, hoje: DataISO, modo: "real" | "log"): Promise<string[]>;
  concluir(lancamentoIds: string[], canal: Canal, hoje: DataISO, ok: boolean, erro?: string): Promise<void>;
};

export type ResumoEnvio = { lembretes: number; falhas: number; cobrancas: number; erros: string[] };

export async function enviarLembretes(
  grupos: GrupoLembrete[],
  canais: CanalEnvio[],
  jaEnviados: Set<string>,
  pagamento: DadosPagamento,
  hoje: DataISO,
  registro: RegistroLembretes,
): Promise<ResumoEnvio> {
  const resumo: ResumoEnvio = { lembretes: 0, falhas: 0, cobrancas: 0, erros: [] };
  for (const grupoCompleto of grupos) {
    for (const canal of canais) {
      const pendente = semJaEnviados(grupoCompleto, jaEnviados, canal.canal);
      if (pendente.itens.length === 0) continue;
      const reservados = new Set(
        await registro.reservar(pendente.cliente.id, pendente.itens, canal.canal, hoje, canal.modo),
      );
      const grupo = { ...pendente, itens: pendente.itens.filter((i) => reservados.has(i.lancamentoId)) };
      if (grupo.itens.length === 0) continue;

      let resultado: { ok: boolean; erro?: string };
      try {
        resultado = await canal.enviar(grupo, montarMensagem(grupo, pagamento), `lembrete-${grupo.cliente.id}-${hoje}-${canal.canal}`);
      } catch (erro) {
        resultado = { ok: false, erro: (erro as Error).message };
      }
      await registro.concluir([...reservados], canal.canal, hoje, resultado.ok, resultado.erro);
      if (resultado.ok) {
        resumo.lembretes++;
        resumo.cobrancas += grupo.itens.length;
      } else {
        resumo.falhas++;
        resumo.erros.push(`${canal.canal} para ${grupo.cliente.nome}: ${resultado.erro}`);
      }
    }
  }
  return resumo;
}
