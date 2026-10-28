# Checklist final — Mov Code Gestão

Legenda dos testes: `U` = `tests/unit`, `DB` = `tests/db` (Postgres em memória), `I` = `tests/integracao` (Supabase local, `npm run test:integracao`), `NAV` = verificado no navegador contra Supabase local durante o desenvolvimento (roteiro manual, não fica no repositório).

Situação ao final: **185 testes automatizados** (U + DB) passando no CI, **12 testes de integração** passando contra Supabase local.

## Telas

| # | Tela / item | Situação | Onde está | Teste |
|---|---|---|---|---|
| 0 | Login com e-mail e senha | Atendido | `src/app/(publico)/login/` · `src/app/(publico)/acoes.ts` | NAV (senha errada, login, volta à página pedida) |
| 0 | "Esqueci minha senha" | Atendido | `src/app/(publico)/esqueci-senha/` · `src/app/auth/confirmar/route.ts` · `src/app/(publico)/redefinir-senha/` | NAV (link do e-mail, nova senha, link usado recusado) |
| 0 | Todas as outras telas exigem login | Atendido | `src/proxy.ts` · `src/lib/auth.ts` · `src/app/(app)/layout.tsx` | U `rotas.test.ts`; DB `estrutura.test.ts` › "visitante não logado não acessa nenhum dado"; NAV |
| 1 | Início com boas-vindas e logo | Atendido | `src/app/(app)/inicio/page.tsx` · `src/components/Logo.tsx` | NAV |
| 2a | Dashboard: entradas e saídas (gráfico interativo) | Atendido | `src/app/(app)/financeiro/page.tsx` · `GraficoEntradasSaidas.tsx` | U `dashboard.test.ts` › "gráfico…"; NAV (tooltip, clique abre o mês) |
| 2a | Filtro por mês, trimestre, ano | Atendido | `src/components/FiltroPeriodo.tsx` · `src/lib/dominio/datas.ts` | U `lancamentos.test.ts` › "períodos do filtro" |
| 2a | Saldo, lucro e MRR | Atendido | `src/lib/dominio/dashboard.ts` · `src/lib/dominio/mensalidades.ts` (`calcularMrr`) | U `dashboard.test.ts` › "saldo e lucro"; U `mensalidades.test.ts` › "MRR"; NAV (valores conferidos à mão) |
| 2a | A receber e a pagar dos próximos 30 dias | Atendido | `src/lib/consultas/dashboard.ts` · `preverRecorrencia` | U `dashboard.test.ts` › "previsão dos próximos 30 dias"; NAV |
| 2a | Inadimplência (valor e lista de clientes ativos) | Atendido | `src/lib/dominio/dashboard.ts` (`resumirInadimplencia`) | U `dashboard.test.ts` › "inadimplência"; NAV |
| 2a | Contato pessoal (>30 dias: cliente, telefone, e-mail, produto, valor, dias) | Atendido | `src/lib/consultas/dashboard.ts` · `src/lib/dominio/lembretes.ts` (`contatoPessoal`) | U `dashboard.test.ts` › "contato pessoal"; NAV |
| 2a | Falhas de envio de lembretes | Atendido | `src/lib/consultas/lembretes.ts` (`resumoLembretes`) · `financeiro/page.tsx` | NAV |
| 2a | Clientes com lembretes pausados e até quando | Atendido | `src/lib/consultas/lembretes.ts` · `financeiro/page.tsx` | DB `clientes.test.ts` › "indicador de lembretes pausados"; NAV |
| 2b | Lançar venda: cliente e produto, valor da tabela conforme o tipo | Atendido | `src/app/(app)/financeiro/vendas/nova/FormularioVenda.tsx` · `acoes.ts` (`registrarVenda`) | U `lancamentos.test.ts` › "formulário de venda"; DB `vendas.test.ts` |
| 2b | Valor editável, com aviso e registro dos dois valores | Atendido | `FormularioVenda.tsx` (`AvisoTabela`) · tabela `vendas` | U `lancamentos.test.ts` › "identifica valor diferente da tabela"; DB `vendas.test.ts` › "parcelas livres" (tabela × praticado) |
| 2b | "Venda única" (Preço) ou "Mensalidade" (Mensalidade + dia de vencimento) | Atendido | `FormularioVenda.tsx` · `supabase/migrations/…05_lancamentos.sql` (`registrar_venda`) | DB `vendas.test.ts` |
| 2b | Parcelas livres e "incluir mensalidade também" (decisões 17/18) | Atendido | idem | DB `vendas.test.ts`; U `lancamentos.test.ts` › "parcelas" |
| 2c | Lançar gasto com categorias Servidor, Ferramentas, Impostos, Salários, Marketing | Atendido | `src/app/(app)/financeiro/gastos/novo/` · `src/lib/dominio/lancamentos.ts` | U `lancamentos.test.ts` › "formulário de gasto" |
| 2c | Gasto recorrente mensal gerado automaticamente | Atendido | `src/lib/servicos/cobrancas.ts` (`gerarGastosRecorrentes`) · tela Gastos recorrentes | U `mensalidades.test.ts` › "gastos recorrentes"; I `rotina-diaria.test.ts` |
| 3 | Produtos: tabela com cadastro, edição e exclusão | Atendido | `src/app/(app)/produtos/` | U `cadastros.test.ts` › "formulário de produto"; DB `estrutura.test.ts` › "6 produtos" e "não permite excluir produto já usado"; NAV |
| 4a | Lista de clientes com "Paga"/"Em atraso" e indicador de pausa | Atendido | `src/app/(app)/clientes/page.tsx` · view `v_clientes` (`…04_clientes_situacao.sql`) | DB `clientes.test.ts`; NAV |
| 4a | Cliente: mensalidades (produto, valor atual, vencimento, início, próximo reajuste, status, situação) e cancelar | Atendido | `src/app/(app)/clientes/[id]/Mensalidades.tsx` · `src/lib/consultas/mensalidades.ts` | U `mensalidades.test.ts` › "próximo reajuste"; DB `reajuste.test.ts` › "cancelar mensalidade"; NAV |
| 4a | Cliente: histórico de lembretes e Pausar/Retomar | Atendido | `src/app/(app)/clientes/[id]/Lembretes.tsx` · `PausarLembretes.tsx` | DB `pausas.test.ts`; NAV |
| 4b | Cadastro: Nome, Telefone (DDD), Email, CPF/CNPJ, Tipo automático, Status | Atendido | `src/app/(app)/clientes/FormularioCliente.tsx` · `src/lib/dominio/cadastros.ts` | U `cadastros.test.ts`; U `documento.test.ts` › "tipo do cliente"; DB `estrutura.test.ts` |
| 5 | Documentos: enviar, listar, abrir, baixar (nuvem, só logados) | Atendido | `src/app/(app)/documentos/` · `src/app/api/documentos/[id]/route.ts` · `…08_documentos.sql` | U `documentos.test.ts`; NAV (inclusive bloqueio sem login e sem link público) |

## Regras de negócio

| Regra | Situação | Onde está | Teste |
|---|---|---|---|
| Todo lançamento tem forma de pagamento (Pix, Cartão, Boleto), vencimento e status | Atendido | tabela `lancamentos` (`…01_estrutura.sql`) | DB `estrutura.test.ts` › "exige data de pagamento…" |
| Pendente com vencimento passado vira Atrasado automaticamente | Atendido | view `v_lancamentos` · `statusEfetivo` | DB `estrutura.test.ts` › "deriva o status"; U `lancamentos.test.ts` › "status do lançamento" |
| Cliente com várias mensalidades, cada uma com produto, valor, início e dia de vencimento | Atendido | tabela `mensalidades` · `registrar_venda` | DB `vendas.test.ts` › "várias mensalidades ao mesmo tempo" |
| Cada mensalidade ativa gera uma cobrança por mês no seu dia | Atendido | `src/lib/dominio/mensalidades.ts` (`planejarMensalidade`) · `src/lib/servicos/cobrancas.ts` | U `mensalidades.test.ts` › "calendário das cobranças"; I `rotina-diaria.test.ts` |
| Cancelar mensalidade: registra data, para só ela, sai do MRR, cobranças ficam | Atendido | `…06_cobrancas_reajuste.sql` (`controlar_cancelamento`) · `cancelarMensalidade` | **cancelamento de mensalidade**: DB `reajuste.test.ts` › "cancelar mensalidade"; U `mensalidades.test.ts` › "cancelada… não geram"; I `rotina-diaria.test.ts` › "cancelar uma mensalidade para só as cobranças dela" |
| Inativar cliente: para cobranças futuras de todas as mensalidades | Atendido | `planejarMensalidade` (`ativa`) | **inativação de cliente**: U `mensalidades.test.ts` › "cliente inativo não geram"; I `rotina-diaria.test.ts` › "cliente inativo…" |
| MRR: só mensalidades ativas de clientes ativos, pelo valor atual; venda única nunca | Atendido | `calcularMrr` | **cálculo de MRR**: U `mensalidades.test.ts` › "MRR"; NAV |
| Reajuste IPCA a cada 12 meses, na 13ª cobrança (decisão 14) | Atendido | `src/lib/dominio/reajuste.ts` · `planejarMensalidade` | **reajuste IPCA**: U `mensalidades.test.ts` › "vale a partir da 13ª cobrança"; I `rotina-diaria.test.ts` › "aplica o reajuste IPCA" |
| IPCA da API do Banco Central (SGS 433), com índice manual se falhar | Atendido* | `src/lib/servicos/ipca-bcb.ts` · tela Reajustes IPCA · `aplicarReajusteManual` | U `ipca.test.ts` (resposta simulada); U `mensalidades.test.ts` › "sem índice…"; NAV (índice manual). *A chamada real ao BCB não pôde ser testada (rede bloqueada no ambiente de desenvolvimento) |
| Aplicação automática (decisão 15); IPCA negativo mantém o valor (decisão 16) | Atendido | `planejarMensalidade` · `valorReajustado` | U `mensalidades.test.ts` › "IPCA acumulado negativo…" |
| Histórico de valores (data, índice, valor anterior e novo) | Atendido | tabela `reajustes` · `aplicar_reajuste` | DB `reajuste.test.ts` › "guarda o histórico" |
| Arredondamento do reajuste em 2 casas | Atendido | `valorReajustado` (meio para cima) | **arredondamento**: U `mensalidades.test.ts` › "arredonda o valor em centavos" |
| Cliente não recebe aviso de reajuste | Atendido | não existe envio de aviso; a cobrança sai com o valor novo | U `mensalidades.test.ts` |
| Mudar preço do produto vale só para vendas novas | Atendido | `valor_atual` só muda por `aplicar_reajuste` (gatilho bloqueia) | DB `reajuste.test.ts` › "não pode ser alterado à mão" |
| Situação do cliente "Em atraso" se qualquer mensalidade tiver cobrança atrasada | Atendido | view `v_clientes` | DB `clientes.test.ts` › "situação do cliente" |
| Lembrete no vencimento e a cada 3 dias; nada antes | Atendido | `src/lib/dominio/lembretes.ts` | **calendário de lembretes**: U `lembretes.test.ts` › "calendário dos lembretes" |
| Último lembrete no 30º dia; depois "Contato pessoal" | Atendido | `diaDeLembrete` · `contatoPessoal` | **último lembrete no 30º dia e Contato pessoal**: U `lembretes.test.ts`; U `dashboard.test.ts` › "contato pessoal"; NAV |
| Ao pagar, para imediatamente | Atendido | `planejarLembretes` · consulta só pendentes | **parada ao pagar**: U `lembretes.test.ts` › "para imediatamente quando a cobrança é paga"; I `lembretes.test.ts` |
| Mensagem: vence hoje / em atraso há X dias; nome, produto, valor, vencimento, Pix; tom da marca | Atendido | `src/lib/lembretes/mensagens.ts` | U `lembretes.test.ts` › "mensagem" |
| Várias cobranças no mesmo dia: um único lembrete por canal | Atendido | `planejarLembretes` · `enviarLembretes` | **agrupamento**: U `lembretes.test.ts` › "agrupa várias cobranças"; I `lembretes.test.ts` |
| Só para pendentes/atrasadas de mensalidades ativas de clientes ativos sem pausa | Atendido | `planejarLembretes` | **quem recebe**: U `lembretes.test.ts` › "quem recebe lembrete"; I `lembretes.test.ts` |
| Nunca o mesmo lembrete duas vezes no dia; registrar cada envio | Atendido | restrição única em `lembretes_enviados` · reserva antes do envio · chave de idempotência | **não duplicidade**: U `lembretes.test.ts` › "nunca envia o mesmo lembrete duas vezes"; I `lembretes.test.ts` › "rodar de novo…" |
| Se um canal falhar, o outro continua | Atendido | `enviarLembretes` | U `lembretes.test.ts` › "se um canal falha, o outro continua"; I `lembretes.test.ts` |
| Envio por **e-mail** (Resend) | Atendido* | `src/lib/lembretes/canais.ts` · `src/lib/servicos/email.ts` | U `lembretes.test.ts` › "chama a API do Resend" (simulada). *Envio real depende do domínio verificado no Resend |
| Envio por **WhatsApp** | **Não atendido** (adiado por decisão do usuário, item 6 do PLANO) | canal preparado para inclusão em `canaisAtivos()` | — |
| Pausa: data final obrigatória, motivo opcional | Atendido | `…07_pausas_lembrete.sql` (`pausar_lembretes`) · `PausarLembretes.tsx` | DB `pausas.test.ts` |
| Pausa vale para todos os lembretes do cliente (canais e mensalidades) | Atendido | `planejarLembretes` (pausa por cliente) | **pausa bloqueando envios**: U `lembretes.test.ts` › "bloqueia os envios durante a pausa"; I `lembretes.test.ts` |
| Pausar não altera cobranças, inadimplência e MRR | Atendido | pausa só é lida pelos lembretes | DB `pausas.test.ts` › "pausar não altera cobranças" |
| Volta sozinha na data final; retomada manual antes | Atendido | `pausaVigente` · `retomar_lembretes` | **retomada automática**: U `lembretes.test.ts`; DB `pausas.test.ts` › "termina sozinha na data final" |
| Sem envio retroativo; contagem dos 30 dias sempre desde o vencimento | Atendido | calendário fixo em `planejarLembretes` | **não envio retroativo**: U `lembretes.test.ts` › "não envia retroativo" e "contagem dos 30 dias" |
| Registrar quem pausou, quem retomou, quando e o motivo | Atendido | tabela `pausas_lembrete` | DB `pausas.test.ts`; NAV |
| Validar CPF/CNPJ pelo dígito verificador | Atendido | `src/lib/dominio/documento.ts` · `documento_valido` (banco) | **validação de CPF/CNPJ**: U `documento.test.ts`; DB `estrutura.test.ts` |
| Impedir cliente duplicado (mesmo CPF/CNPJ) | Atendido | `clientes.documento unique` (normalizado) | **duplicidade**: DB `estrutura.test.ts` › "impede cliente duplicado"; NAV |
| Validar telefone (com DDD) e e-mail | Atendido | `documento.ts` · restrições da tabela | U `documento.test.ts`; DB `estrutura.test.ts` |
| Lançamentos editados e excluídos, com confirmação; registrar quem criou/editou/excluiu | Atendido | `src/app/(app)/financeiro/lancamentos/[id]/` · gatilhos de auditoria | DB `estrutura.test.ts` › "registra quem criou, editou e excluiu"; NAV |
| Exportar lançamentos filtrados para Excel e PDF | Atendido | `src/lib/servicos/exportacao.ts` · `src/app/api/exportar/[formato]/route.ts` | U `exportacao.test.ts`; NAV |
| Backup periódico automático, com restauração | Atendido | `…09_backup.sql` · `src/lib/servicos/backup.ts` · tela Backup | DB `backup.test.ts`; U `backup.test.ts`; I `backup.test.ts`; NAV |
| Cadastro público desativado | Atendido | `supabase/config.toml` · README passo 4.1 | NAV (cadastro recusado pela API) |
| Dois usuários com acesso total (decisão 5) | Atendido | RLS por `authenticated` · `scripts/criar-usuario.ts` | DB `estrutura.test.ts` › "segurança de acesso"; NAV |

## Restrições

| Restrição | Situação | Onde está | Teste |
|---|---|---|---|
| Dinheiro em centavos, sem ponto flutuante | Atendido | `src/lib/dominio/dinheiro.ts` · colunas `*_centavos bigint` | U `dinheiro.test.ts` |
| Dia de vencimento 1–31; meses curtos caem no último dia | Atendido | `vencimentoNoMes` · restrição `dia_vencimento between 1 and 31` | **vencimento em meses curtos**: U `mensalidades.test.ts` › "dia 31 cai no último dia…"; U `datas.test.ts`; DB `vendas.test.ts` › "fora de 1 a 31" |
| Segredos só em variáveis de ambiente; `.env.example` sem valores reais | Atendido | `.env.example` · `.gitignore` · `src/lib/env.ts` | revisão do repositório (nenhuma chave, nem a chave Pix, está no código) |
| Em desenvolvimento, lembretes só registrados no log | Atendido | `canaisAtivos` / `envioRealAtivo` | U `lembretes.test.ts` › "em desenvolvimento nunca envia de verdade" |
| Interface em português do Brasil | Atendido | todas as telas, mensagens e e-mails | NAV |
| Layout responsivo (computador e celular) | Atendido | Tailwind; menu lateral/celular em `src/components/Menu.tsx` | NAV (sem rolagem lateral a 390 px em todas as telas) |

## Prospecção

| Item | Situação | Onde está | Teste |
|---|---|---|---|
| Leads do Instagram, um por @, com funil de 7 etapas | Atendido | `…10_prospeccao.sql` · `src/lib/dominio/prospeccao.ts` | DB `prospeccao.test.ts` › "um lead por @…", "recusa etapa desconhecida…"; U `prospeccao.test.ts` › "@ do Instagram" |
| Fila do dia: follow-ups vencidos + melhores novos (meus ou sem responsável) | Atendido | `src/app/(app)/prospeccao/page.tsx` | U `prospeccao.test.ts` › "calendário dos follow-ups"; NAV |
| Follow-ups em 3 e 4 dias, máximo 2, sugestão de Perdido | Atendido | `aplicarAcao` · `acoesDaVez` · `semResposta` | U `prospeccao.test.ts` › "calendário dos follow-ups" |
| Ação registrada uma vez só (clique repetido / tela desatualizada) | Atendido | `aplicarAcao` · `registrarAcao` (grava só se etapa e follow-ups não mudaram) | U `prospeccao.test.ts` › "não registra a mesma ação duas vezes" |
| Pipeline com filtros (etapa, responsável, busca) e lead manual | Atendido | `src/app/(app)/prospeccao/pipeline/` | U `prospeccao.test.ts` › "formulários"; NAV |
| Configuração da busca editável na tela | Atendido | `src/app/(app)/prospeccao/configuracao/` | U `prospeccao.test.ts` › "configuração…"; DB `prospeccao.test.ts` › "configuração padrão" |
| Busca diária grava pela API com token | Atendido | `src/app/api/prospeccao/rotina/route.ts` · `src/lib/servicos/prospeccao.ts` · `src/lib/segredo.ts` | U `segredo.test.ts`; U `prospeccao.test.ts` › "leads que chegam da busca diária"; U `rotas.test.ts`; NAV |
| Importação do painel antigo, sem duplicar | Atendido | `importarDoPainel` · `lerExportacaoPainel` | U `prospeccao.test.ts` › "importação do painel antigo"; NAV |
| Lead vira cliente | Atendido | `src/app/(app)/clientes/novo/page.tsx` · `salvarCliente` | DB `prospeccao.test.ts` › "ao excluir o cliente…"; NAV |
| Só logados acessam; autoria e auditoria | Atendido | RLS e gatilhos em `…10_prospeccao.sql` | DB `prospeccao.test.ts` › "visitante não logado…", "autoria e auditoria" |
| Leads no backup; backups antigos continuam restauráveis | Atendido | `tabelas_backup` · `restaurar_backup` (`…10_prospeccao.sql`) | DB `backup.test.ts` › "o backup contém todas as tabelas", "backup feito antes da Prospecção…" |

## Pendências e observações

1. **WhatsApp**: não implementado, por decisão (orçamento/plano gratuito). Passo a passo para ativar no README, seção 12.
2. **Integrações reais não testadas daqui** (rede restrita no ambiente de desenvolvimento): API do IPCA do Banco Central, envio pelo Resend e o agendamento da Vercel. Conferir após publicar (README, seção 8).
3. **Testes de navegador (NAV)** foram executados durante o desenvolvimento contra um Supabase local, mas não ficaram no repositório como testes automáticos (dependem de dados e serviços locais).
