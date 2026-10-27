"use client";

import { useRouter } from "next/navigation";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatarReais } from "@/lib/dominio/dinheiro";

type Ponto = { mes: string; entradas: number; saidas: number };

const NOMES_MES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const rotuloMes = (mes: string) => `${NOMES_MES[Number(mes.slice(5, 7)) - 1]}/${mes.slice(2, 4)}`;
const compacto = new Intl.NumberFormat("pt-BR", { notation: "compact", maximumFractionDigits: 1 });

/** Entradas e saídas pagas por mês. Clicar num mês abre o dashboard daquele mês. */
export function GraficoEntradasSaidas({ dados }: { dados: Ponto[] }) {
  const router = useRouter();
  const abrirMes = (mes: string) => router.push(`/financeiro?periodo=mes&ref=${mes}-01`);

  return (
    <figure className="flex flex-col gap-3">
      <figcaption className="text-sm text-texto-secundario">
        Entradas e saídas pagas por mês (regime de caixa). Clique num mês para ver o detalhe.
      </figcaption>
      <div className="h-72 w-full">
        <ResponsiveContainer>
          <BarChart data={dados} barGap={2} barCategoryGap="25%" margin={{ top: 16, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid vertical={false} stroke="var(--borda)" strokeDasharray="0" />
            <XAxis
              dataKey="mes"
              tickFormatter={rotuloMes}
              tick={{ fill: "var(--texto-secundario)", fontSize: 12 }}
              axisLine={{ stroke: "var(--borda)" }}
              tickLine={false}
            />
            <YAxis
              tickFormatter={(v: number) => `R$\u00a0${compacto.format(v / 100)}`}
              tick={{ fill: "var(--texto-secundario)", fontSize: 12 }}
              axisLine={false}
              tickLine={false}
              width={84}
            />
            <Tooltip
              cursor={{ fill: "var(--borda)", opacity: 0.4 }}
              contentStyle={{ background: "var(--superficie)", border: "1px solid var(--borda)", borderRadius: 12 }}
              labelStyle={{ color: "var(--texto)", fontWeight: 600 }}
              itemStyle={{ color: "var(--texto)" }}
              labelFormatter={(mes) => rotuloMes(String(mes))}
              formatter={(valor, nome) => [formatarReais(Number(valor)), nome]}
            />
            <Legend
              iconType="circle"
              wrapperStyle={{ color: "var(--texto-secundario)", fontSize: 13 }}
              formatter={(nome) => <span style={{ color: "var(--texto-secundario)" }}>{nome}</span>}
            />
            <Bar
              dataKey="entradas"
              name="Entradas"
              fill="var(--grafico-entradas)"
              radius={[4, 4, 0, 0]}
              maxBarSize={36}
              cursor="pointer"
              onClick={(d) => abrirMes((d as unknown as { payload: Ponto }).payload.mes)}
            />
            <Bar
              dataKey="saidas"
              name="Saídas"
              fill="var(--grafico-saidas)"
              radius={[4, 4, 0, 0]}
              maxBarSize={36}
              cursor="pointer"
              onClick={(d) => abrirMes((d as unknown as { payload: Ponto }).payload.mes)}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <details className="text-sm">
        <summary className="cursor-pointer text-texto-secundario hover:text-texto">Ver em tabela</summary>
        <table className="mt-2 w-full text-left tabular-nums">
          <thead className="text-texto-secundario">
            <tr>
              <th className="py-1 font-medium">Mês</th>
              <th className="py-1 text-right font-medium">Entradas</th>
              <th className="py-1 text-right font-medium">Saídas</th>
              <th className="py-1 text-right font-medium">Resultado</th>
            </tr>
          </thead>
          <tbody>
            {dados.map((d) => (
              <tr key={d.mes} className="border-t border-borda">
                <td className="py-1">{rotuloMes(d.mes)}</td>
                <td className="py-1 text-right">{formatarReais(d.entradas)}</td>
                <td className="py-1 text-right">{formatarReais(d.saidas)}</td>
                <td className="py-1 text-right">{formatarReais(d.entradas - d.saidas)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
}
