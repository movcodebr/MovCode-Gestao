/**
 * Textos dos lembretes de cobrança. Para mudar o tom ou uma palavra, edite só este arquivo.
 */
import { formatarData } from "@/lib/dominio/datas";
import { formatarReais } from "@/lib/dominio/dinheiro";
import type { GrupoLembrete, ItemLembrete } from "@/lib/dominio/lembretes";

export type DadosPagamento = { chavePix: string; favorecido: string };
export type Mensagem = { assunto: string; texto: string; html: string };

const ASSINATURA = "Equipe Mov Code — Tecnologia do tamanho do seu negócio.";

function escaparHtml(texto: string): string {
  return texto.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

function situacao(item: ItemLembrete): string {
  return item.diasAtraso === 0
    ? `vence hoje (${formatarData(item.vencimento)})`
    : `venceu em ${formatarData(item.vencimento)} (há ${item.diasAtraso} ${item.diasAtraso === 1 ? "dia" : "dias"})`;
}

export function montarMensagem(grupo: GrupoLembrete, pagamento: DadosPagamento): Mensagem {
  const { itens } = grupo;
  const nome = grupo.cliente.nome;
  const umItem = itens.length === 1 ? itens[0] : null;
  const venceHoje = umItem?.diasAtraso === 0;
  const total = itens.reduce((s, i) => s + i.valor, 0);

  const assunto = !umItem
    ? "Lembrete de pagamento — Mov Code"
    : venceHoje
      ? "Sua mensalidade Mov Code vence hoje"
      : `Mensalidade Mov Code em aberto há ${umItem.diasAtraso} dias`;

  const abertura = !umItem
    ? `Oi, ${nome}! Tudo certo?\n\nSeguem as mensalidades em aberto:`
    : venceHoje
      ? `Oi, ${nome}! Tudo certo?\n\nPassando pra lembrar que esta mensalidade vence hoje:`
      : `Oi, ${nome}! Tudo bem?\n\nNotamos que esta mensalidade ainda está em aberto:`;

  const chamadaPix = venceHoje ? "Pra pagar é rapidinho, via Pix:" : umItem ? "Pra regularizar, é só fazer o Pix:" : "Pra pagar, é só fazer o Pix:";
  const fechamento =
    venceHoje
      ? "Se já pagou, pode desconsiderar este e-mail. Qualquer dúvida, é só responder aqui."
      : "Se já pagou, desconsidera este e-mail. Se rolou algum imprevisto, responde aqui que a gente conversa e combina o melhor jeito.";

  const linhas = itens.map((i) => `• ${i.produto} — ${formatarReais(i.valor)} — ${situacao(i)}`);
  const texto = [
    abertura,
    "",
    ...linhas,
    ...(umItem ? [] : ["", `Total: ${formatarReais(total)}`]),
    "",
    chamadaPix,
    `Chave Pix: ${pagamento.chavePix}`,
    `Favorecido: ${pagamento.favorecido}`,
    "",
    fechamento,
    "",
    "Valeu!",
    ASSINATURA,
  ].join("\n");

  const e = escaparHtml;
  const linhasHtml = itens
    .map(
      (i) => `<tr><td style="padding:8px 0;border-bottom:1px solid #eee"><strong>${e(i.produto)}</strong><br>
<span style="color:#555">${e(situacao(i)).replace(/(hoje|há \d+ dias?)/, "<strong>$1</strong>")}</span></td>
<td style="padding:8px 0;border-bottom:1px solid #eee;text-align:right;white-space:nowrap"><strong>${e(formatarReais(i.valor))}</strong></td></tr>`,
    )
    .join("");
  const html = `<!doctype html><html lang="pt-BR"><body style="margin:0;background:#f4f4f5;font-family:Arial,Helvetica,sans-serif;color:#111214">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:24px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:16px;padding:28px">
<tr><td style="font-size:22px;font-weight:bold;padding-bottom:16px">Mov<span style="color:#ff5a1f">Code.</span></td></tr>
<tr><td style="font-size:15px;line-height:1.6">${e(abertura).replace(/\n\n/g, "</p><p>").replace(/^/, "<p>")}</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:15px">${linhasHtml}
${umItem ? "" : `<tr><td style="padding:10px 0"><strong>Total</strong></td><td style="padding:10px 0;text-align:right"><strong>${e(formatarReais(total))}</strong></td></tr>`}
</table>
<p>${e(chamadaPix)}</p>
<p style="background:#fff3ed;border-left:4px solid #ff5a1f;padding:12px 14px;border-radius:8px;margin:0 0 16px">
<strong>Chave Pix:</strong> ${e(pagamento.chavePix)}<br><strong>Favorecido:</strong> ${e(pagamento.favorecido)}</p>
<p>${e(fechamento)}</p>
<p>Valeu!<br><strong>Equipe Mov Code</strong><br><span style="color:#555">Tecnologia do tamanho do seu negócio.</span></p>
</td></tr></table></td></tr></table></body></html>`;

  return { assunto, texto, html };
}
