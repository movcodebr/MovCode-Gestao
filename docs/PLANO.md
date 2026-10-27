# Plano — Sistema de Gestão Mov Code

> Documento vivo. Etapa 1 (respostas) e Etapa 2 (plano). Toda mudança de regra deve ser registrada aqui antes de ir para o código.

---

## 1. Respostas da Etapa 1

| # | Item | Decisão |
|---|---|---|
| 1 | Cores | Fundo `#111214` · destaque `#FF5A1F` · texto `#FFFFFF` · texto secundário `#B7BAC2` · bordas/superfícies `#2D2F31` · texto sobre laranja `#111214` |
| 2 | Fontes | **Inter** (textos, tabelas, números) e **Anton** (títulos), via Google Fonts |
| 3 | Logo | `public/logo-simbolo.svg` (símbolo) + texto "Mov**Code.**" ("Code." em laranja) |
| 4 | Repositório | `movcodebr/MovCode-Gestao` |
| 5 | Permissões | Os 2 usuários têm acesso total. Todas as ações ficam registradas por usuário |
| 6 | Orçamento | Somente planos gratuitos (Supabase Free, Vercel Hobby, Resend Free). **WhatsApp adiado**: lembretes só por e-mail, com arquitetura por canal pronta para ligar o WhatsApp depois |
| 7 | Número WhatsApp | Não se aplica por enquanto (adiado junto com o WhatsApp) |
| 8 | E-mail remetente | `contato@movcode.com.br` (responder para o mesmo). Domínio precisa ser verificado no Resend |
| 9 | Dados de pagamento | Pix (chave CPF) — favorecido Vinicius Martins Hallal. **Fica em variável de ambiente** (`PAGAMENTO_PIX_CHAVE`, `PAGAMENTO_PIX_NOME`), nunca no repositório |
| 10 | Horário de envio | 9h, horário de Brasília (agendador gratuito pode atrasar até ~1h) |
| 11 | Frequência do backup | Diário (mantém os últimos 30) + backup mensal mantido por 12 meses |
| 12 | Destino do backup | Bucket privado no Supabase Storage; o backup mensal também vai por e-mail para `contato@movcode.com.br` |
| 13 | Valor da venda editável | Sim; quando diferente da tabela, o formulário avisa e o sistema guarda os dois valores (tabela e praticado) |
| 14 | Primeiro reajuste | Na **13ª cobrança** (aniversário de 12 meses) |
| 15 | Aplicação do reajuste | Automática. Se a API do BCB falhar: nova tentativa diária + aviso no dashboard com campo para informar o índice manualmente; enquanto isso, a cobrança sai com o valor antigo e o reajuste passa a valer na cobrança seguinte à obtenção do índice |
| 16 | IPCA negativo | Mantém o valor (registra reajuste de 0% com o índice real no histórico) |
| 17 | Implantação + mensalidade | Um único formulário com a opção "incluir mensalidade também", que gera os dois registros |
| 18 | Venda única | Parcelas livres (valor e vencimento por parcela), 1 parcela por padrão; a soma das parcelas tem que bater com o total |
| 19 | Início da mensalidade | Campo "data de início" (padrão: data da venda); 1ª cobrança no primeiro dia de vencimento ≥ data de início |
| 20 | Criação das cobranças | No dia do vencimento (tarefa diária). O "a receber/a pagar dos próximos 30 dias" soma lançamentos existentes + previsão calculada das mensalidades e gastos recorrentes |
| 21 | Baixa de pagamento | Manual: data do pagamento (padrão hoje) + forma de pagamento |
| 22 | Saldo e lucro | Lucro = entradas pagas − saídas pagas no período (regime de caixa, pela data de pagamento). Saldo = acumulado em caixa desde o início até o fim do período |
| 23 | Gasto recorrente | Data de fim opcional + botão "Encerrar recorrência". Alterar o valor vale só para os meses seguintes |
| 24 | Reativar cliente | Cobranças voltam no próximo vencimento a partir da reativação, sem retroativo. A data de início (e o aniversário do reajuste) não muda |
| 25 | Excluir produto usado | Bloqueado; o produto pode ser **desativado** (some de vendas novas, permanece no histórico) |
| 26 | Janela do IPCA | Os 12 meses que terminam 2 meses antes do mês do aniversário (ex.: aniversário em jan/2027 → dez/2025 a nov/2026). Fator = Π(1 + iₘ/100); novo valor arredondado em 2 casas, meio para cima |
| — | Fuso horário | Todas as datas e regras usam `America/Sao_Paulo` |

---

## 2. Stack

| Camada | Escolha | Por quê |
|---|---|---|
| Aplicação web | **Next.js 16** (App Router, React, TypeScript) | Telas e backend no mesmo projeto; Server Actions evitam uma API separada |
| Estilo | Tailwind CSS + componentes próprios (padrão shadcn/ui) | Responsivo, tema escuro da marca em um único arquivo de tokens |
| Gráficos | Recharts | Gráficos interativos simples para o dashboard |
| Formulários | react-hook-form + zod | Mesmas regras de validação no navegador e no servidor |
| Banco, login, arquivos | **Supabase** (PostgreSQL, Auth, Storage) | Plano gratuito cobre o volume; RLS garante que só usuário logado acessa |
| Hospedagem | **Vercel Hobby** | Grátis, deploy automático a cada push |
| Tarefas agendadas | **Vercel Cron** (1 execução diária às 12:00 UTC = 9h de Brasília) | Grátis; chama `/api/cron/diario` protegido por `CRON_SECRET` |
| E-mail | **Resend** (plano gratuito: 3.000/mês, 100/dia) | API simples; em desenvolvimento apenas registra no log |
| IPCA | API pública do Banco Central (SGS, série 433) | Exigência do briefing; índice manual como reserva |
| Exportação | `exceljs` (.xlsx) e `pdfmake` (PDF) | Geração no servidor, sem serviço pago |
| Testes | **Vitest** (regras de negócio) + **PGlite** (Postgres em memória para testar migrações, restrições e funções SQL) | Rodam no CI sem Docker nem conta no Supabase |
| CI | GitHub Actions: lint, typecheck, testes a cada push | Nada quebrado entra no `main` |

**Dinheiro**: sempre em **centavos inteiros** (`bigint` no banco, `number` inteiro no TypeScript, validado como inteiro seguro). O fator do IPCA é calculado com `decimal.js`; o arredondamento final para centavos é "meio para cima".

**Status "Atrasado"**: o banco guarda apenas `pago` ou `pendente`; a view `v_lancamentos` deriva `Atrasado` quando `pendente` e `vencimento < hoje (Brasília)`. Assim o status está sempre certo na hora da consulta, sem depender da tarefa diária.

---

## 3. Estrutura de pastas

```
MovCode-Gestao/
├─ docs/PLANO.md                    este arquivo
├─ public/logo-simbolo.svg
├─ supabase/
│  ├─ config.toml                   cadastro público desativado
│  ├─ migrations/                   SQL versionado (tabelas, views, RLS, gatilhos)
│  └─ seed.sql                      carga inicial dos 6 produtos
├─ scripts/criar-usuario.ts         cria os 2 usuários (sem cadastro público)
├─ src/
│  ├─ app/
│  │  ├─ (publico)/login, esqueci-senha, redefinir-senha
│  │  ├─ (app)/inicio
│  │  ├─ (app)/financeiro            dashboard
│  │  ├─ (app)/financeiro/lancamentos   lista, filtros, exportação, editar/excluir, baixa
│  │  ├─ (app)/financeiro/vendas/nova
│  │  ├─ (app)/financeiro/gastos/novo   (+ gastos recorrentes)
│  │  ├─ (app)/produtos
│  │  ├─ (app)/clientes, clientes/[id]
│  │  ├─ (app)/documentos
│  │  ├─ (app)/backup
│  │  └─ api/cron/diario, api/exportar/[formato]
│  ├─ components/                   UI (botões, tabelas, modais, logo, menu)
│  ├─ lib/
│  │  ├─ dominio/                   REGRAS DE NEGÓCIO PURAS (sem banco) — 100% testadas
│  │  │  ├─ dinheiro.ts             centavos, formatação R$, arredondamento
│  │  │  ├─ documento.ts            CPF/CNPJ, tipo, telefone, e-mail
│  │  │  ├─ datas.ts                fuso Brasília, vencimento em meses curtos
│  │  │  ├─ mensalidades.ts         calendário de cobranças, nº da cobrança, MRR
│  │  │  ├─ reajuste.ts             janela IPCA, fator, novo valor
│  │  │  ├─ lembretes.ts            quem recebe, calendário 0/3/…/30, contato pessoal, agrupamento, pausa
│  │  │  └─ dashboard.ts            saldo, lucro, previsões, inadimplência
│  │  ├─ servicos/                  orquestração com banco e APIs externas
│  │  │  ├─ tarefa-diaria.ts        ordem da rotina das 9h
│  │  │  ├─ ipca-bcb.ts
│  │  │  ├─ canais/email.ts, canais/whatsapp.ts (desativado), canais/log.ts
│  │  │  └─ backup.ts
│  │  └─ supabase/                  clientes servidor/navegador/admin
│  └─ middleware.ts                 bloqueia toda rota sem login
├─ tests/
│  ├─ unit/                         Vitest: regras de dominio/
│  └─ db/                           Vitest + PGlite: migrações, restrições, views
├─ .env.example                     nomes das variáveis, sem valores reais
└─ .github/workflows/ci.yml
```

---

## 4. Modelo de dados

Convenções: chaves `uuid`; valores em `*_centavos bigint check (>= 0)`; auditoria (`criado_por`, `criado_em`, `atualizado_por`, `atualizado_em`) em todas as tabelas de negócio; exclusão de lançamentos é **lógica** (`excluido_em`, `excluido_por`) para não perder histórico nem permitir que o gerador recrie a cobrança.

### usuarios (perfil, ligado a `auth.users`)
`id` (= auth.users.id) · `nome` · `email`

### clientes
`id` · `nome` · `telefone` (só dígitos, com DDD, 10–11 dígitos) · `email` · `documento` (só dígitos, **único**) · `tipo` (`PF`/`PJ`, calculado: 11 dígitos = PF, 14 = PJ) · `ativo` (bool) · `reativado_em` (date, nulo) · auditoria

### produtos
`id` · `nome` (único) · `preco_centavos` · `mensalidade_centavos` · `ativo` · auditoria

### vendas
`id` · `cliente_id` · `produto_id` · `tipo` (`unica`/`mensalidade`) · `valor_tabela_centavos` (valor da tabela no momento) · `valor_centavos` (praticado) · `data_venda` · auditoria

### mensalidades
`id` · `venda_id` · `cliente_id` · `produto_id` · `valor_inicial_centavos` · `valor_atual_centavos` · `dia_vencimento` (1–31) · `data_inicio` · `forma_pagamento` · `status` (`ativa`/`cancelada`) · `cancelada_em` · `cancelada_por` · auditoria

### reajustes (histórico de valores)
`id` · `mensalidade_id` · `aniversario` (1, 2, …) · `aplicado_em` · `vale_a_partir_da_cobranca` (competência) · `janela_inicio` / `janela_fim` (meses do IPCA) · `indice_percentual` (numeric, real, pode ser negativo) · `indice_aplicado` (numeric, 0 se negativo) · `fonte` (`bcb`/`manual`) · `valor_anterior_centavos` · `valor_novo_centavos` · `registrado_por` · **único (mensalidade_id, aniversario)**

### ipca_mensal (cache da série 433)
`competencia` (date, 1º dia do mês, PK) · `variacao_percentual` (numeric) · `fonte` (`bcb`/`manual`) · `registrado_por`

### gastos_recorrentes
`id` · `descricao` · `categoria` · `valor_centavos` (vale para os próximos meses) · `forma_pagamento` · `dia_vencimento` · `data_inicio` · `data_fim` (opcional) · `encerrado_em` · `encerrado_por` · auditoria

### lancamentos (entradas e saídas; uma **cobrança** é um lançamento de entrada ligado a uma mensalidade)
`id` · `tipo` (`entrada`/`saida`) · `descricao` · `valor_centavos` · `forma_pagamento` (`pix`/`cartao`/`boleto`) · `vencimento` · `status` (`pago`/`pendente`; `Atrasado` é derivado) · `data_pagamento` · `categoria` (saídas: Servidor, Ferramentas, Impostos, Salários, Marketing) · `cliente_id` · `venda_id` + `parcela` (venda única) · `mensalidade_id` + `competencia` (cobrança) · `gasto_recorrente_id` + `competencia` · `excluido_em` · `excluido_por` · auditoria
Restrições: **único (mensalidade_id, competencia)** e **único (gasto_recorrente_id, competencia)** — impede cobrança em dobro mesmo se a tarefa rodar duas vezes; `pago` ⇔ `data_pagamento` preenchida.

### pausas_lembrete
`id` · `cliente_id` · `inicio` · `fim` (obrigatório, > início) · `motivo` (opcional) · `criado_por` · `criado_em` · `retomado_em` · `retomado_por`
Uma pausa está **vigente** em D se `inicio ≤ D < fim` e não foi retomada antes de D. Só uma pausa vigente por cliente.

### lembretes_enviados
`id` · `lancamento_id` · `cliente_id` · `data_referencia` · `dias_atraso` · `canal` (`email`/`whatsapp`) · `sucesso` · `erro` · `modo` (`real`/`log`) · `criado_em`
**Único (lancamento_id, canal, data_referencia)** — garante que o mesmo lembrete nunca sai duas vezes no mesmo dia.

### documentos
`id` · `nome` · `caminho` (bucket privado `documentos`) · `tamanho_bytes` · `tipo_mime` · `enviado_por` · `criado_em`

### backups
`id` · `tipo` (`diario`/`mensal`) · `caminho` (bucket privado `backups`) · `tamanho_bytes` · `criado_em` · `enviado_por_email` · `restaurado_em` · `restaurado_por`

### auditoria
`id` · `tabela` · `registro_id` · `acao` (`criou`/`editou`/`excluiu`/`pausou`/`retomou`/…) · `usuario_id` · `em` · `antes` (jsonb) · `depois` (jsonb) — preenchida por gatilhos no banco.

### Segurança (RLS)
Todas as tabelas com RLS ligado: leitura e escrita só para `authenticated` (os 2 usuários têm acesso total). A tarefa diária usa a chave de serviço apenas no servidor. Cadastro público desativado no Supabase Auth; usuários criados pelo script `scripts/criar-usuario.ts`.

---

## 5. Regras-chave (como serão implementadas)

- **Vencimento em mês curto**: `vencimento(ano, mes, dia) = min(dia, últimoDia(ano, mes))`.
- **Calendário da mensalidade**: 1ª cobrança = primeiro vencimento ≥ `data_inicio`; depois uma por mês. **Número da cobrança** = meses corridos desde a 1ª + 1 (calendário, não contagem de cobranças geradas — períodos de inatividade não deslocam o aniversário).
- **Geração diária** (idempotente): para cada mensalidade `ativa` de cliente ativo, cria a cobrança de toda competência com vencimento ≤ hoje, ≥ `data_inicio` e ≥ `reativado_em` (se houver), que ainda não exista. Isso também recupera dias em que a tarefa não rodou.
- **Reajuste**: o aniversário *k* vale a partir da cobrança nº 12k+1. Antes de gerar essa cobrança, o sistema busca a janela IPCA (12 meses terminando 2 meses antes do mês dessa cobrança), aplica `novo = arred(valor_atual × max(fator, 1))` e grava o histórico. Sem índice disponível → cobrança sai com valor atual e o reajuste fica pendente (aviso no dashboard).
- **Cancelar mensalidade**: `status = cancelada`, `cancelada_em = hoje`; deixa de gerar cobranças, sai do MRR; cobranças existentes permanecem.
- **Inativar cliente**: nenhuma mensalidade dele gera cobrança; saem do MRR; nenhum lembrete. Cobranças existentes permanecem.
- **MRR** = Σ `valor_atual` das mensalidades `ativas` de clientes `ativos`.
- **Situação do cliente** = "Em atraso" se existir cobrança de mensalidade dele com status derivado `Atrasado` (não excluída); senão "Paga".
- **Lembretes** (só e-mail por enquanto), para cada cobrança `pendente` de mensalidade ativa de cliente ativo, com `d = hoje − vencimento`:
  - envia se `0 ≤ d ≤ 30` e `d % 3 == 0` e não há pausa vigente hoje;
  - `d == 0` → mensagem "vence hoje"; `d > 0` → "em atraso há d dias";
  - `d > 30` → não envia; aparece em **Contato pessoal** até ser paga, a mensalidade cancelada ou o cliente inativado;
  - várias cobranças do mesmo cliente no mesmo dia → **um** e-mail listando todas;
  - cada canal registrado separadamente; falha em um não impede o outro;
  - lembretes que cairiam na pausa não são reenviados depois (o calendário é sempre relativo ao vencimento);
  - em desenvolvimento (`LEMBRETES_MODO=log`) nada é enviado, só registrado.
- **Rotina diária (9h)**, nesta ordem: 1) atualizar cache do IPCA; 2) gerar cobranças de mensalidades (com reajustes); 3) gerar gastos recorrentes; 4) enviar lembretes; 5) backup diário (+ mensal no dia 1º). Cada passo registra seu resultado; falha de um não impede os seguintes.

---

## 6. Fases de implementação

Cada fase termina com: testes escritos e passando, commit em português, push e um resumo curto para aprovação.

| Fase | Conteúdo | Testes principais |
|---|---|---|
| **0. Fundação** | Projeto Next.js + TypeScript, Tailwind com tema da marca, fontes, lint, Vitest, PGlite, CI no GitHub Actions, `.env.example` | build, lint, smoke test |
| **1. Banco e login** | Migrações de todas as tabelas, views, RLS, gatilhos de auditoria, seed dos produtos; login, "esqueci minha senha", redefinição, middleware, layout com menu responsivo, tela Início com logo; script para criar os 2 usuários | migrações aplicam do zero; RLS nega anônimo; seed com 6 produtos; restrições de unicidade |
| **2. Produtos e Clientes** | CRUD de produtos (desativar em vez de excluir quando usado); cadastro/edição de clientes, inativar/reativar | CPF/CNPJ (dígito verificador), tipo automático, duplicidade, telefone, e-mail, bloqueio de exclusão de produto usado |
| **3. Lançamentos** | Venda única (parcelas livres), mensalidade, "incluir mensalidade também"; gastos avulsos e recorrentes; lista com filtros; editar, excluir (com confirmação), marcar como pago; registro de quem fez | soma das parcelas, valor diferente da tabela, status Atrasado derivado, auditoria de criação/edição/exclusão |
| **4. Motor de cobranças e reajuste** | Geração diária de cobranças e gastos recorrentes, cancelamento de mensalidade, inativação/reativação, IPCA (BCB + manual), reajuste automático, endpoint do cron | vencimento em meses curtos, nº da cobrança, idempotência, cancelamento, inativação, reativação sem retroativo, janela IPCA, fator, arredondamento, IPCA negativo, 13ª cobrança, falha da API |
| **5. Dashboard, cliente e exportação** | Indicadores (saldo, lucro, MRR), gráfico de entradas/saídas, filtros mês/trimestre/ano, a receber/a pagar 30 dias, inadimplência, contato pessoal; tela do cliente (mensalidades, cancelar, situação); exportação .xlsx e PDF | MRR, saldo/lucro por caixa, previsões, inadimplência, situação do cliente, conteúdo da exportação |
| **6. Lembretes** | Canal e-mail (Resend) + canal log; WhatsApp desativado; modelos de mensagem; pausas (pausar/retomar, histórico); falhas e pausas no dashboard; histórico de lembretes no cliente | calendário 0/3/…/30, contato pessoal após 30, parada ao pagar, agrupamento, quem recebe, não duplicidade, pausa bloqueia, retomada automática na data final, não retroativo, falha de canal isolada, modo log em dev |
| **7. Documentos** | Upload, lista, abrir, baixar, excluir — bucket privado, só logado | acesso negado sem login; metadados gravados |
| **8. Backup** | Backup diário/mensal em JSON no Storage, retenção 30 diários/12 mensais, envio do mensal por e-mail, tela de backups com restauração (com confirmação) | backup contém todas as tabelas; restauração recria os dados exatamente; retenção |

Depois das fases: **Etapa 4** (README completo para não especialistas) e **Etapa 5** (checklist final tela a tela e regra a regra).

---

## 7. Limitações conhecidas (plano gratuito)

- **Vercel Hobby**: os termos de uso preveem uso não comercial; o cron roda 1x/dia com precisão de até ~1h.
- **Supabase Free**: projetos sem atividade podem ser pausados; a rotina diária mantém o projeto em uso, mas convém confirmar após a publicação. Não há backup baixável pelo Supabase — por isso o backup próprio (Fase 8).
- **Backup** cobre os dados do banco; os arquivos da tela Documentos ficam no Storage e não são copiados no backup diário (limite de 1 GB do plano gratuito).
- **Lembretes perdidos**: se a rotina diária não rodar num dia, os lembretes daquele dia não são reenviados depois (mesma lógica de "não retroativo"); as cobranças, por outro lado, são recuperadas.
- **WhatsApp**: adiado por decisão do usuário; o canal existe no código, desativado.
