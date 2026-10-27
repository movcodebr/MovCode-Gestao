-- =====================================================================
-- Mov Code — Gestão: estrutura do banco
-- Dinheiro sempre em centavos (bigint). Datas no fuso America/Sao_Paulo.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Funções utilitárias
-- ---------------------------------------------------------------------

-- "Hoje" no fuso de Brasília. A configuração app.hoje existe só para os
-- testes automatizados simularem datas; em produção ela nunca é definida.
create or replace function public.hoje()
returns date
language sql
stable
set search_path = ''
as $$
  select coalesce(
    nullif(current_setting('app.hoje', true), '')::date,
    (now() at time zone 'America/Sao_Paulo')::date
  );
$$;

-- Valida CPF (11 dígitos) ou CNPJ (14 caracteres, numérico ou alfanumérico)
-- pelo dígito verificador. Mesmo algoritmo de src/lib/dominio/documento.ts.
create or replace function public.documento_valido(doc text)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
declare
  soma int;
  resto int;
  dv int;
  i int;
  pesos1 int[] := array[5,4,3,2,9,8,7,6,5,4,3,2];
  pesos2 int[] := array[6,5,4,3,2,9,8,7,6,5,4,3,2];
begin
  if doc ~ '^\d{11}$' then
    if doc ~ '^(\d)\1{10}$' then
      return false;
    end if;
    for dv in 10..11 loop
      soma := 0;
      for i in 1..dv - 1 loop
        soma := soma + substr(doc, i, 1)::int * (dv + 1 - i);
      end loop;
      resto := (soma * 10) % 11;
      if resto = 10 then resto := 0; end if;
      if resto <> substr(doc, dv, 1)::int then
        return false;
      end if;
    end loop;
    return true;
  elsif doc ~ '^[0-9A-Z]{12}\d{2}$' then
    if doc ~ '^(\d)\1{13}$' then
      return false;
    end if;
    soma := 0;
    for i in 1..12 loop
      soma := soma + (ascii(substr(doc, i, 1)) - 48) * pesos1[i];
    end loop;
    resto := soma % 11;
    if (case when resto < 2 then 0 else 11 - resto end) <> substr(doc, 13, 1)::int then
      return false;
    end if;
    soma := 0;
    for i in 1..13 loop
      soma := soma + (ascii(substr(doc, i, 1)) - 48) * pesos2[i];
    end loop;
    resto := soma % 11;
    return (case when resto < 2 then 0 else 11 - resto end) = substr(doc, 14, 1)::int;
  end if;
  return false;
end;
$$;

-- ---------------------------------------------------------------------
-- Usuários (perfil ligado ao login do Supabase Auth)
-- ---------------------------------------------------------------------
create table public.usuarios (
  id uuid primary key references auth.users (id) on delete cascade,
  nome text not null,
  email text not null unique
);

-- Cria o perfil automaticamente quando um usuário é criado no Auth.
create or replace function public.criar_perfil_usuario()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.usuarios (id, nome, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'nome', split_part(new.email, '@', 1)),
    new.email
  );
  return new;
end;
$$;

create trigger ao_criar_usuario
after insert on auth.users
for each row execute function public.criar_perfil_usuario();

-- ---------------------------------------------------------------------
-- Clientes
-- ---------------------------------------------------------------------
create table public.clientes (
  id uuid primary key default gen_random_uuid(),
  nome text not null check (length(trim(nome)) > 0),
  -- Só dígitos, com DDD: fixo (10) ou celular (11, começa com 9)
  telefone text not null check (telefone ~ '^[1-9][1-9](9\d{8}|[2-8]\d{7})$'),
  email text not null check (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  -- Só dígitos (CPF) ou dígitos/letras maiúsculas (CNPJ alfanumérico)
  documento text not null unique check (public.documento_valido(documento)),
  tipo text generated always as (
    case when length(documento) = 11 then 'PF' else 'PJ' end
  ) stored,
  ativo boolean not null default true,
  -- Data da última reativação: cobranças antes dela não são geradas
  reativado_em date,
  criado_por uuid references public.usuarios (id) on delete set null,
  criado_em timestamptz not null default now(),
  atualizado_por uuid references public.usuarios (id) on delete set null,
  atualizado_em timestamptz
);

-- ---------------------------------------------------------------------
-- Produtos
-- ---------------------------------------------------------------------
create table public.produtos (
  id uuid primary key default gen_random_uuid(),
  nome text not null check (length(trim(nome)) > 0),
  preco_centavos bigint not null check (preco_centavos >= 0),
  mensalidade_centavos bigint not null check (mensalidade_centavos >= 0),
  ativo boolean not null default true,
  criado_por uuid references public.usuarios (id) on delete set null,
  criado_em timestamptz not null default now(),
  atualizado_por uuid references public.usuarios (id) on delete set null,
  atualizado_em timestamptz
);
create unique index produtos_nome_unico on public.produtos (lower(nome));

-- ---------------------------------------------------------------------
-- Vendas (a origem de parcelas de venda única e de mensalidades)
-- ---------------------------------------------------------------------
create table public.vendas (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references public.clientes (id) on delete restrict,
  -- on delete restrict: produto usado em venda não pode ser excluído
  produto_id uuid not null references public.produtos (id) on delete restrict,
  tipo text not null check (tipo in ('unica', 'mensalidade')),
  valor_tabela_centavos bigint not null check (valor_tabela_centavos >= 0),
  valor_centavos bigint not null check (valor_centavos > 0),
  data_venda date not null,
  criado_por uuid references public.usuarios (id) on delete set null,
  criado_em timestamptz not null default now(),
  atualizado_por uuid references public.usuarios (id) on delete set null,
  atualizado_em timestamptz
);

-- ---------------------------------------------------------------------
-- Mensalidades
-- ---------------------------------------------------------------------
create table public.mensalidades (
  id uuid primary key default gen_random_uuid(),
  venda_id uuid not null unique references public.vendas (id) on delete restrict,
  cliente_id uuid not null references public.clientes (id) on delete restrict,
  produto_id uuid not null references public.produtos (id) on delete restrict,
  valor_inicial_centavos bigint not null check (valor_inicial_centavos > 0),
  valor_atual_centavos bigint not null check (valor_atual_centavos > 0),
  dia_vencimento smallint not null check (dia_vencimento between 1 and 31),
  data_inicio date not null,
  forma_pagamento text not null check (forma_pagamento in ('pix', 'cartao', 'boleto')),
  status text not null default 'ativa' check (status in ('ativa', 'cancelada')),
  cancelada_em date,
  cancelada_por uuid references public.usuarios (id) on delete set null,
  criado_por uuid references public.usuarios (id) on delete set null,
  criado_em timestamptz not null default now(),
  atualizado_por uuid references public.usuarios (id) on delete set null,
  atualizado_em timestamptz,
  check ((status = 'cancelada') = (cancelada_em is not null))
);

-- ---------------------------------------------------------------------
-- IPCA mensal (cache da série 433 do Banco Central) e reajustes
-- ---------------------------------------------------------------------
create table public.ipca_mensal (
  competencia date primary key check (competencia = date_trunc('month', competencia)::date),
  variacao_percentual numeric(8, 4) not null,
  fonte text not null check (fonte in ('bcb', 'manual')),
  registrado_por uuid references public.usuarios (id) on delete set null,
  registrado_em timestamptz not null default now()
);

create table public.reajustes (
  id uuid primary key default gen_random_uuid(),
  mensalidade_id uuid not null references public.mensalidades (id) on delete restrict,
  aniversario smallint not null check (aniversario >= 1),
  aplicado_em date not null,
  -- Competência (mês) da primeira cobrança com o valor novo
  vale_a_partir_de date not null check (vale_a_partir_de = date_trunc('month', vale_a_partir_de)::date),
  janela_inicio date not null,
  janela_fim date not null,
  indice_percentual numeric(10, 6) not null,
  indice_aplicado numeric(10, 6) not null check (indice_aplicado >= 0),
  fonte text not null check (fonte in ('bcb', 'manual')),
  valor_anterior_centavos bigint not null check (valor_anterior_centavos > 0),
  valor_novo_centavos bigint not null check (valor_novo_centavos >= valor_anterior_centavos),
  registrado_por uuid references public.usuarios (id) on delete set null,
  registrado_em timestamptz not null default now(),
  unique (mensalidade_id, aniversario)
);

-- ---------------------------------------------------------------------
-- Gastos recorrentes (geram um lançamento de saída por mês)
-- ---------------------------------------------------------------------
create table public.gastos_recorrentes (
  id uuid primary key default gen_random_uuid(),
  descricao text not null check (length(trim(descricao)) > 0),
  categoria text not null check (categoria in ('servidor', 'ferramentas', 'impostos', 'salarios', 'marketing')),
  valor_centavos bigint not null check (valor_centavos > 0),
  forma_pagamento text not null check (forma_pagamento in ('pix', 'cartao', 'boleto')),
  dia_vencimento smallint not null check (dia_vencimento between 1 and 31),
  data_inicio date not null,
  data_fim date check (data_fim is null or data_fim >= data_inicio),
  encerrado_em date,
  encerrado_por uuid references public.usuarios (id) on delete set null,
  criado_por uuid references public.usuarios (id) on delete set null,
  criado_em timestamptz not null default now(),
  atualizado_por uuid references public.usuarios (id) on delete set null,
  atualizado_em timestamptz
);

-- ---------------------------------------------------------------------
-- Lançamentos (entradas e saídas). Uma COBRANÇA é uma entrada ligada a
-- uma mensalidade. Exclusão é lógica (excluido_em) para manter histórico.
-- ---------------------------------------------------------------------
create table public.lancamentos (
  id uuid primary key default gen_random_uuid(),
  tipo text not null check (tipo in ('entrada', 'saida')),
  descricao text not null check (length(trim(descricao)) > 0),
  valor_centavos bigint not null check (valor_centavos > 0),
  forma_pagamento text not null check (forma_pagamento in ('pix', 'cartao', 'boleto')),
  vencimento date not null,
  -- "Atrasado" não é gravado: é derivado na view v_lancamentos
  status text not null default 'pendente' check (status in ('pago', 'pendente')),
  data_pagamento date,
  categoria text check (categoria in ('servidor', 'ferramentas', 'impostos', 'salarios', 'marketing')),
  cliente_id uuid references public.clientes (id) on delete restrict,
  venda_id uuid references public.vendas (id) on delete restrict,
  parcela smallint check (parcela >= 1),
  mensalidade_id uuid references public.mensalidades (id) on delete restrict,
  gasto_recorrente_id uuid references public.gastos_recorrentes (id) on delete restrict,
  competencia date check (competencia = date_trunc('month', competencia)::date),
  excluido_em timestamptz,
  excluido_por uuid references public.usuarios (id) on delete set null,
  criado_por uuid references public.usuarios (id) on delete set null,
  criado_em timestamptz not null default now(),
  atualizado_por uuid references public.usuarios (id) on delete set null,
  atualizado_em timestamptz,

  check ((status = 'pago') = (data_pagamento is not null)),
  -- Saídas têm categoria; entradas não
  check ((tipo = 'saida') = (categoria is not null)),
  -- No máximo uma origem
  check (num_nonnulls(venda_id, mensalidade_id, gasto_recorrente_id) <= 1),
  check ((venda_id is null) = (parcela is null)),
  check (venda_id is null or tipo = 'entrada'),
  check (mensalidade_id is null or (tipo = 'entrada' and competencia is not null and cliente_id is not null)),
  check (gasto_recorrente_id is null or (tipo = 'saida' and competencia is not null)),
  check ((competencia is null) = (mensalidade_id is null and gasto_recorrente_id is null)),
  check (excluido_por is null or excluido_em is not null),

  -- Impedem cobrança/gasto em dobro, mesmo que a rotina rode duas vezes
  -- (inclui excluídos: uma cobrança excluída não é recriada).
  unique (mensalidade_id, competencia),
  unique (gasto_recorrente_id, competencia),
  unique (venda_id, parcela)
);
create index lancamentos_vencimento on public.lancamentos (vencimento) where excluido_em is null;
create index lancamentos_cliente on public.lancamentos (cliente_id);

-- Lançamentos ativos com o status efetivo (Atrasado derivado).
create view public.v_lancamentos
with (security_invoker = true)
as
select
  l.*,
  case
    when l.status = 'pago' then 'pago'
    when l.vencimento < public.hoje() then 'atrasado'
    else 'pendente'
  end as status_efetivo,
  case
    when l.status = 'pendente' and l.vencimento < public.hoje()
      then public.hoje() - l.vencimento
    else 0
  end as dias_atraso
from public.lancamentos l
where l.excluido_em is null;

-- ---------------------------------------------------------------------
-- Pausas de lembretes e lembretes enviados
-- ---------------------------------------------------------------------
create table public.pausas_lembrete (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references public.clientes (id) on delete restrict,
  inicio date not null,
  -- Na data final os lembretes voltam (a pausa vale até o dia anterior)
  fim date not null,
  motivo text,
  criado_por uuid references public.usuarios (id) on delete set null,
  criado_em timestamptz not null default now(),
  retomado_em date,
  retomado_por uuid references public.usuarios (id) on delete set null,
  check (fim > inicio),
  check (retomado_em is null or retomado_em >= inicio)
);

create table public.lembretes_enviados (
  id uuid primary key default gen_random_uuid(),
  lancamento_id uuid not null references public.lancamentos (id) on delete restrict,
  cliente_id uuid not null references public.clientes (id) on delete restrict,
  data_referencia date not null,
  dias_atraso smallint not null check (dias_atraso between 0 and 30),
  canal text not null check (canal in ('email', 'whatsapp')),
  sucesso boolean not null,
  erro text,
  modo text not null check (modo in ('real', 'log')),
  criado_em timestamptz not null default now(),
  -- Nunca o mesmo lembrete duas vezes para a mesma cobrança no mesmo dia
  unique (lancamento_id, canal, data_referencia)
);

-- ---------------------------------------------------------------------
-- Documentos e backups (metadados; arquivos ficam no Storage)
-- ---------------------------------------------------------------------
create table public.documentos (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  caminho text not null unique,
  tamanho_bytes bigint not null check (tamanho_bytes >= 0),
  tipo_mime text,
  enviado_por uuid references public.usuarios (id) on delete set null,
  criado_em timestamptz not null default now()
);

create table public.backups (
  id uuid primary key default gen_random_uuid(),
  tipo text not null check (tipo in ('diario', 'mensal')),
  caminho text not null unique,
  tamanho_bytes bigint not null check (tamanho_bytes >= 0),
  criado_em timestamptz not null default now(),
  enviado_por_email boolean not null default false,
  restaurado_em timestamptz,
  restaurado_por uuid references public.usuarios (id) on delete set null
);

-- ---------------------------------------------------------------------
-- Auditoria: quem criou, editou ou excluiu cada registro
-- ---------------------------------------------------------------------
create table public.auditoria (
  id bigint generated always as identity primary key,
  tabela text not null,
  registro_id uuid not null,
  acao text not null check (acao in ('criou', 'editou', 'excluiu')),
  usuario_id uuid references public.usuarios (id) on delete set null,
  em timestamptz not null default now(),
  antes jsonb,
  depois jsonb
);
create index auditoria_registro on public.auditoria (tabela, registro_id);
