# Mov Code — Gestão

Sistema web de controle interno da **Mov Code**: financeiro (vendas, gastos, mensalidades, dashboard), produtos, clientes, lembretes de cobrança por e-mail, documentos internos e backup.

> **Tecnologia do tamanho do seu negócio.**

Este guia foi escrito para quem **não é especialista**. Siga as seções na ordem. Onde aparecer `assim`, é algo para copiar e colar.

---

## Sumário

1. [O que você vai precisar](#1-o-que-você-vai-precisar)
2. [Criar o banco de dados (Supabase)](#2-criar-o-banco-de-dados-supabase)
3. [Configurar o e-mail (Resend)](#3-configurar-o-e-mail-resend)
4. [Configurar o login e o "esqueci minha senha"](#4-configurar-o-login-e-o-esqueci-minha-senha)
5. [Publicar na internet (Vercel)](#5-publicar-na-internet-vercel)
6. [Criar os 2 usuários](#6-criar-os-2-usuários)
7. [Ligar o envio real de e-mails](#7-ligar-o-envio-real-de-e-mails)
8. [Conferir se está tudo funcionando](#8-conferir-se-está-tudo-funcionando)
9. [Variáveis de ambiente (referência)](#9-variáveis-de-ambiente-referência)
10. [Uso no dia a dia](#10-uso-no-dia-a-dia)
11. [Backup e restauração](#11-backup-e-restauração)
12. [WhatsApp (para ativar no futuro)](#12-whatsapp-para-ativar-no-futuro)
13. [Para desenvolvedores](#13-para-desenvolvedores)
14. [Limitações conhecidas](#14-limitações-conhecidas)

---

## 1. O que você vai precisar

| O quê | Para quê | Custo |
|---|---|---|
| Conta no **GitHub** (já existe: `movcodebr/MovCode-Gestao`) | Guarda o código | Grátis |
| Conta no **Supabase** — https://supabase.com | Banco de dados, login e arquivos | Plano Free |
| Conta no **Resend** — https://resend.com | Envio dos e-mails (lembretes e backup) | Plano Free (3.000 e-mails/mês) |
| Conta na **Vercel** — https://vercel.com | Deixa o sistema no ar e roda a rotina diária das 9h | Plano Hobby |
| Acesso ao **DNS do domínio** `movcode.com.br` (Registro.br, Hostinger, Cloudflare…) | Autorizar o envio de e-mails por `contato@movcode.com.br` | — |
| Um computador com **Node.js 22** — https://nodejs.org | Só para criar os usuários (passo 6) | Grátis |

Antes de publicar, o código desenvolvido precisa estar no ramo principal (`main`) do GitHub. Se ele ainda estiver num ramo separado (por exemplo `claude/...`), abra um *Pull Request* no GitHub e faça o *merge* para o `main`.

---

## 2. Criar o banco de dados (Supabase)

### 2.1 Criar o projeto
1. Entre em https://supabase.com e clique em **New project**.
2. Nome: `movcode-gestao`. Crie uma **senha forte para o banco** e guarde num lugar seguro.
3. Região: **South America (São Paulo)**.
4. Aguarde alguns minutos até o projeto ficar pronto.

### 2.2 Copiar as chaves
No projeto, vá em **Project Settings → API** (ou **API Keys**) e anote:

| No Supabase | Vai na variável |
|---|---|
| Project URL | `NEXT_PUBLIC_SUPABASE_URL` |
| `anon` / *publishable* key | `NEXT_PUBLIC_SUPABASE_ANON_KEY` |
| `service_role` / *secret* key | `SUPABASE_SERVICE_ROLE_KEY` ⚠️ **secreta**: nunca compartilhe nem coloque no código |

### 2.3 Criar as tabelas (migrações)
As tabelas, regras de segurança e a carga inicial dos 6 produtos estão na pasta `supabase/migrations`. Há dois jeitos de aplicá-las:

**Jeito A — pelo terminal (recomendado)**, no seu computador, dentro da pasta do projeto:
```bash
npm install
npx supabase login
npx supabase link --project-ref SEU_PROJECT_REF   # o "Reference ID" em Project Settings → General
npx supabase db push
```
Confirme com `Y`. O comando aplica todos os arquivos na ordem.

**Jeito B — pelo navegador:** no Supabase, abra **SQL Editor**, e para cada arquivo de `supabase/migrations` (em ordem de nome, do `...0001` ao último) cole o conteúdo e clique em **Run**.

Ao final, em **Table Editor** você deve ver as tabelas (`clientes`, `produtos`, `lancamentos`…) e a tabela `produtos` com os 6 produtos do catálogo. Em **Storage** devem aparecer os espaços privados `documentos` e `backups`.

---

## 3. Configurar o e-mail (Resend)

O Resend envia os lembretes de cobrança, o backup mensal e (passo 4) os e-mails de "esqueci minha senha".

1. Crie a conta em https://resend.com.
2. Vá em **Domains → Add Domain** e informe `movcode.com.br`.
3. O Resend mostra alguns **registros DNS** (tipo TXT e MX). Entre no painel onde o domínio está registrado (Registro.br, Hostinger, Cloudflare…), na parte de **DNS / Zona DNS**, e crie exatamente esses registros.
   - Se o domínio já recebe e-mails (por exemplo pelo Google Workspace), **não apague** os registros MX existentes: os registros do Resend usam um subdomínio próprio (como `send.movcode.com.br`) e convivem com os atuais.
4. Volte ao Resend e clique em **Verify**. A verificação pode levar de minutos a algumas horas.
5. Vá em **API Keys → Create API Key**, com permissão de envio (*Sending access*). Copie a chave (começa com `re_`): ela vai em `RESEND_API_KEY`.

---

## 4. Configurar o login e o "esqueci minha senha"

No Supabase:

### 4.1 Desativar o cadastro público
**Authentication → Sign In / Providers** (ou **Settings**): desligue **Allow new users to sign up**. Assim, só os usuários criados por vocês (passo 6) conseguem entrar.

### 4.2 Endereço do sistema
**Authentication → URL Configuration**:
- **Site URL:** o endereço do sistema na Vercel (passo 5), por exemplo `https://movcode-gestao.vercel.app`.
- **Redirect URLs:** adicione `https://movcode-gestao.vercel.app/auth/confirmar` (troque pelo seu endereço).

### 4.3 E-mail de "esqueci minha senha" pelo Resend
O e-mail padrão do Supabase tem limite muito baixo e só entrega para membros da equipe do Supabase. Use o Resend:

**Authentication → Emails → SMTP Settings** → ative **Custom SMTP**:

| Campo | Valor |
|---|---|
| Sender email | `contato@movcode.com.br` |
| Sender name | `Mov Code` |
| Host | `smtp.resend.com` |
| Port | `465` |
| Username | `resend` |
| Password | a chave do Resend (`re_...`) |

### 4.4 Modelo do e-mail de redefinição de senha
**Authentication → Emails → Templates → Reset Password**. Assunto: `Mov Code — redefinir senha`. Corpo:

```html
<p>Oi! Recebemos um pedido para criar uma nova senha no sistema de gestão da Mov Code.</p>
<p><a href="{{ .SiteURL }}/auth/confirmar?token_hash={{ .TokenHash }}&type=recovery&destino=/redefinir-senha">Clique aqui para criar uma nova senha</a></p>
<p>Se não foi você, é só ignorar este e-mail.</p>
```

Esse formato de link funciona em qualquer navegador (inclusive se o e-mail for aberto no celular).

---

## 5. Publicar na internet (Vercel)

1. Entre em https://vercel.com com a conta do GitHub.
2. **Add New → Project** → escolha o repositório `movcodebr/MovCode-Gestao` → **Import**.
3. Antes de clicar em **Deploy**, abra **Environment Variables** e cadastre as variáveis da [seção 9](#9-variáveis-de-ambiente-referência). Por enquanto deixe `EMAILS_MODO` = `log` (nenhum e-mail sai de verdade).
4. Para o `CRON_SECRET`, invente um texto aleatório longo (por exemplo, gere em https://www.uuidgenerator.net e junte dois). A Vercel usa esse segredo para chamar a rotina diária; ninguém mais consegue chamá-la.
5. Clique em **Deploy**. Ao final, a Vercel mostra o endereço (ex.: `https://movcode-gestao.vercel.app`). Coloque esse endereço em `NEXT_PUBLIC_SITE_URL` (Settings → Environment Variables) e no Supabase (passo 4.2), e faça **Redeploy**.

### A rotina diária das 9h
O arquivo `vercel.json` agenda a rotina `/api/cron/diario` para **12:00 UTC = 9h de Brasília**, todo dia. Ela faz, nesta ordem:
1. busca o IPCA no Banco Central;
2. gera as cobranças das mensalidades do dia (com o reajuste IPCA quando for a hora);
3. lança os gastos recorrentes do dia;
4. envia os lembretes de cobrança;
5. faz o backup (e o mensal, no primeiro dia do mês).

Em **Settings → Cron Jobs** da Vercel dá para ver as execuções e rodar na hora (**Run**). No plano Hobby a execução pode atrasar até ~1 hora.

> Domínio próprio (opcional): em **Settings → Domains** da Vercel dá para usar, por exemplo, `gestao.movcode.com.br`. Se fizer isso, atualize `NEXT_PUBLIC_SITE_URL` e o passo 4.2.

---

## 6. Criar os 2 usuários

No seu computador, dentro da pasta do projeto:

1. Copie o arquivo `.env.example` para `.env.local` e preencha `NEXT_PUBLIC_SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` (do passo 2.2).
2. Rode, uma vez para cada pessoa:
   ```bash
   npm install
   npm run criar-usuario
   ```
3. Informe **nome**, **e-mail** e **senha** (mínimo 8 caracteres; a senha não aparece enquanto você digita).

Os dois usuários têm acesso total. Cada um pode trocar a própria senha pelo "esqueci minha senha" na tela de login.

> O `.env.local` contém a chave secreta: ele **não vai para o GitHub** (já está no `.gitignore`). Se quiser, apague-o depois de criar os usuários.

---

## 7. Ligar o envio real de e-mails

Quando o domínio estiver verificado no Resend (passo 3) e o sistema publicado:

1. Confira as variáveis `RESEND_API_KEY`, `EMAIL_REMETENTE`, `PAGAMENTO_PIX_CHAVE`, `PAGAMENTO_PIX_NOME` e `BACKUP_EMAIL_DESTINO` na Vercel.
2. Mude `EMAILS_MODO` para `real` (**Settings → Environment Variables**, ambiente *Production*) e faça **Redeploy**.

Enquanto `EMAILS_MODO` não for `real`, nada é enviado de verdade: os lembretes aparecem na tela do cliente como **"modo teste (não enviado)"**. Fora do ambiente de produção o envio real fica sempre desligado, mesmo com `real`.

> Dica: antes de ligar, cadastre um cliente de teste com o **seu próprio e-mail** e uma mensalidade vencendo no dia, para receber e conferir o lembrete.

---

## 8. Conferir se está tudo funcionando

- [ ] Abrir o endereço do sistema leva à tela de login; sem login nenhuma página abre.
- [ ] Entrar com os 2 usuários.
- [ ] "Esqueci minha senha" envia o e-mail e o link abre a tela de nova senha.
- [ ] **Produtos** mostra os 6 produtos do catálogo.
- [ ] Na Vercel, **Cron Jobs → Run** na rotina: depois, em **Financeiro → Reajustes IPCA** aparece "Último IPCA recebido" e em **Backup** aparece o primeiro backup.
- [ ] Com `EMAILS_MODO=real`, o cliente de teste recebe o lembrete; falhas aparecem em **Financeiro → Falhas de envio de lembretes**.

---

## 9. Variáveis de ambiente (referência)

O modelo está em `.env.example` (sem valores reais). **Nunca** coloque senhas e chaves no código ou no GitHub.

| Variável | O que é | Exemplo |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Endereço do projeto Supabase | `https://abcd.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Chave pública do Supabase | `eyJ...` ou `sb_publishable_...` |
| `SUPABASE_SERVICE_ROLE_KEY` | Chave **secreta** do Supabase (rotina, backup, criar usuários) | `eyJ...` ou `sb_secret_...` |
| `NEXT_PUBLIC_SITE_URL` | Endereço do sistema | `https://movcode-gestao.vercel.app` |
| `CRON_SECRET` | Segredo da rotina diária | texto aleatório longo |
| `RESEND_API_KEY` | Chave do Resend | `re_...` |
| `EMAIL_REMETENTE` | Quem envia | `contato@movcode.com.br` |
| `EMAIL_RESPONDER_PARA` | Para onde vão as respostas dos clientes | `contato@movcode.com.br` |
| `EMAILS_MODO` | `log` (só registra) ou `real` (envia) | `log` |
| `PAGAMENTO_PIX_CHAVE` | Chave Pix que vai nos lembretes | (a chave) |
| `PAGAMENTO_PIX_NOME` | Favorecido do Pix | `Vinicius Martins Hallal` |
| `BACKUP_EMAIL_DESTINO` | Quem recebe o backup mensal | `contato@movcode.com.br` |

---

## 10. Uso no dia a dia

- **Clientes → Novo cliente**: CPF ou CNPJ (o tipo Pessoa Física/Empresa é automático), telefone com DDD e e-mail. O sistema não aceita CPF/CNPJ inválido nem repetido.
- **Lançar venda** (na tela do cliente ou em Financeiro): escolha o produto; o valor vem da tabela e pode ser ajustado (o sistema avisa quando fica diferente). *Venda única* pode ser dividida em parcelas livres; *Mensalidade* pede o dia de vencimento e a data de início. "Incluir mensalidade também" registra as duas coisas de uma vez.
- **Mensalidades** geram uma cobrança por mês, sozinhas, no dia do vencimento (em meses mais curtos, no último dia). Nenhuma cobrança é criada com data anterior ao cadastro.
- **Marcar pago** (em Lançamentos): informe a data em que o dinheiro entrou. Pendentes vencidos aparecem como **Atrasado** automaticamente.
- **Reajuste IPCA**: automático na 13ª cobrança de cada mensalidade. Se o Banco Central não responder, o reajuste aparece em **Financeiro → Reajustes IPCA** para você informar o índice.
- **Lembretes**: no vencimento e a cada 3 dias, até 30 dias de atraso; depois, a cobrança vai para **Contato pessoal** no dashboard. Para negociar prazo, use **Pausar lembretes** na tela do cliente.
- **Exportar para o contador**: em Lançamentos, filtre o período e clique em **Exportar Excel** ou **Exportar PDF**.
- Os textos dos e-mails de lembrete ficam em `src/lib/lembretes/mensagens.ts`; as cores da marca em `src/app/globals.css`.

---

## 11. Backup e restauração

- **Automático**: todo dia às 9h (guarda os 30 últimos) e um por mês (guarda 12 meses). O mensal também chega por e-mail em `BACKUP_EMAIL_DESTINO`, como anexo `.json.gz` — guarde esses e-mails.
- **Manual**: tela **Backup → Fazer backup agora** (recomendado antes de mudanças grandes).
- **Restaurar**: tela **Backup → Restaurar** (de um backup da lista) ou **Restaurar de um arquivo** (por exemplo o anexo do e-mail mensal). É preciso digitar `RESTAURAR`. Antes de restaurar o sistema guarda automaticamente o estado atual, para poder desfazer. A restauração é "tudo ou nada": se algo falhar, nada muda.
- **O que não entra no backup**: os logins dos usuários (continuam os atuais) e os **arquivos** da tela Documentos (ficam no Storage do Supabase; se forem importantes, guarde cópias também fora do sistema).

---

## 12. WhatsApp (para ativar no futuro)

O WhatsApp ficou **desligado** por decisão de projeto; os lembretes saem só por e-mail. O sistema já trata cada canal separadamente (se um falhar, o outro continua) e registra os envios por canal. Para ativar:

1. Criar uma conta **WhatsApp Business Cloud API** na Meta (https://developers.facebook.com), com um número de telefone da empresa.
2. Cadastrar e aprovar **modelos de mensagem** (*templates*) de cobrança na Meta — mensagens iniciadas pela empresa exigem modelo aprovado.
3. Implementar um canal em `src/lib/lembretes/canais.ts` (um objeto `CanalEnvio` com `canal: "whatsapp"`) que chame a API da Meta, e incluí-lo em `canaisAtivos()`.
4. Adicionar as variáveis (token e ID do número) na Vercel.

---

## 13. Para desenvolvedores

**Stack:** Next.js 16 (App Router, TypeScript) · Tailwind CSS · Supabase (PostgreSQL, Auth, Storage) · Vercel (hospedagem e cron) · Resend · Vitest + PGlite.

### Rodar no computador
Requisitos: Node.js 22 e Docker (para o Supabase local).
```bash
npm install
npx supabase start          # sobe Postgres, Auth e Storage locais e aplica as migrações
cp .env.example .env.local  # preencha com as chaves que o comando acima mostrou
npm run criar-usuario
npm run dev                 # http://localhost:3000
```
Para rodar a rotina diária localmente:
```bash
curl -H "Authorization: Bearer SEU_CRON_SECRET" http://localhost:3000/api/cron/diario
```

### Comandos
| Comando | O que faz |
|---|---|
| `npm run dev` | Servidor de desenvolvimento |
| `npm run build` | Gera a versão de produção |
| `npm test` | Testes automatizados (regras de negócio e banco em memória) |
| `npm run test:integracao` | Testes contra o Supabase local (precisa de `npx supabase start`) |
| `npm run verificar` | Lint + tipos + testes (o mesmo que o CI roda) |
| `npm run criar-usuario` | Cria um usuário do sistema |

### Organização
```
supabase/migrations/   tabelas, regras, segurança (RLS), funções de banco
src/lib/dominio/       regras de negócio puras e testadas (dinheiro, datas, mensalidades, reajuste, lembretes…)
src/lib/servicos/      rotina diária, cobranças, IPCA, lembretes, backup, exportação, e-mail
src/lib/consultas/     consultas usadas pelas telas
src/app/(app)/         telas internas (exigem login)   src/app/(publico)/  login e senha
tests/unit · tests/db · tests/integracao
docs/PLANO.md          decisões e plano do projeto
```

Princípios: dinheiro sempre em **centavos inteiros**; datas no fuso **America/Sao_Paulo**; regras críticas garantidas **também no banco** (restrições de unicidade contra cobrança/lembrete em dobro, auditoria por gatilho, exclusão lógica de lançamentos); toda mudança de regra deve ser registrada em `docs/PLANO.md` e coberta por teste.

O CI (GitHub Actions) roda lint, tipos, testes e build a cada push.

---

## 14. Limitações conhecidas

- **Planos gratuitos**: os termos do plano Hobby da Vercel preveem uso não comercial; o cron roda 1x por dia e pode atrasar até ~1h. O Supabase Free pode pausar projetos sem uso — a rotina diária mantém o projeto ativo, mas vale conferir de vez em quando.
- **Lembretes perdidos**: se a rotina não rodar num dia, os lembretes daquele dia não são reenviados depois (as cobranças, sim, são recuperadas).
- **Backup** não inclui os arquivos da tela Documentos nem os logins.
- **WhatsApp** desativado (ver seção 12).
- Restaurar backup enviando arquivo aceita até 4 MB (o backup compactado de vários anos de dados de uma pequena empresa costuma ter poucas centenas de KB).
