import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { type Banco, comoUsuario, CPF_VALIDO, criarBanco, criarUsuario, definirHoje } from "./banco";

let db: Banco;
let fundador: string;
let socio: string;
let clienteId: string;

beforeAll(async () => {
  db = await criarBanco();
  fundador = await criarUsuario(db, "f@movcode.com.br", "Fundador");
  socio = await criarUsuario(db, "s@movcode.com.br", "Sócio");
  clienteId = (
    await db.query<{ id: string }>(
      "insert into clientes (nome, telefone, email, documento) values ('C', '11987654321', 'c@x.com', $1) returning id",
      [CPF_VALIDO],
    )
  ).rows[0].id;
});
afterAll(() => db.close());

const pausar = (fim: string, motivo: string | null, usuario = fundador) =>
  comoUsuario(db, usuario, () => db.query("select pausar_lembretes($1, $2, $3)", [clienteId, fim, motivo]));
const retomar = (usuario = socio) => comoUsuario(db, usuario, () => db.query("select retomar_lembretes($1)", [clienteId]));
const pausadoAte = async () =>
  (await db.query<{ ate: string | null }>("select to_char(lembretes_pausados_ate, 'YYYY-MM-DD') as ate from v_clientes where id = $1", [clienteId]))
    .rows[0].ate;

describe("pausar e retomar lembretes", () => {
  it("exige data final depois de hoje", async () => {
    await definirHoje(db, "2026-03-10");
    await expect(pausar("2026-03-10", null)).rejects.toThrow(/depois de hoje/);
  });

  it("registra quem pausou, quando e o motivo (opcional)", async () => {
    await pausar("2026-03-20", "prazo negociado até dia 20");
    const { rows } = await db.query(
      "select to_char(inicio,'YYYY-MM-DD') as inicio, to_char(fim,'YYYY-MM-DD') as fim, motivo, criado_por from pausas_lembrete",
    );
    expect(rows).toEqual([{ inicio: "2026-03-10", fim: "2026-03-20", motivo: "prazo negociado até dia 20", criado_por: fundador }]);
    expect(await pausadoAte()).toBe("2026-03-20");
  });

  it("não permite duas pausas ao mesmo tempo", async () => {
    await expect(pausar("2026-03-25", null)).rejects.toThrow(/já estão pausados/);
  });

  it("retomar manualmente registra quem retomou e quando", async () => {
    await definirHoje(db, "2026-03-14");
    await retomar();
    const { rows } = await db.query("select to_char(retomado_em,'YYYY-MM-DD') as em, retomado_por from pausas_lembrete");
    expect(rows).toEqual([{ em: "2026-03-14", retomado_por: socio }]);
    expect(await pausadoAte()).toBeNull();
    await expect(retomar()).rejects.toThrow(/não estão pausados/);
  });

  it("a pausa termina sozinha na data final", async () => {
    await pausar("2026-03-18", null);
    await definirHoje(db, "2026-03-17");
    expect(await pausadoAte()).toBe("2026-03-18");
    await definirHoje(db, "2026-03-18");
    expect(await pausadoAte()).toBeNull();
    // e já pode pausar de novo
    await pausar("2026-03-30", "novo acordo");
    expect(await pausadoAte()).toBe("2026-03-30");
  });

  it("pausar não altera cobranças", async () => {
    const auditoria = await db.query("select distinct tabela from auditoria where tabela not in ('clientes', 'produtos') order by 1");
    expect(auditoria.rows).toEqual([{ tabela: "pausas_lembrete" }]);
  });
});
