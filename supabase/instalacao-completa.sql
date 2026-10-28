-- =====================================================================
-- Mov Code — Gestão: instalação completa do banco (gerado automaticamente)
-- Cole TUDO no SQL Editor do Supabase e clique em Run, uma única vez,
-- num projeto novo. Não edite este arquivo: ele é gerado a partir de
-- supabase/migrations com "npm run gerar-instalacao-sql".
-- =====================================================================

-- >>> 20261027000001_estrutura.sql
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

-- >>> 20261027000002_auditoria_e_seguranca.sql
-- =====================================================================
-- Autoria automática, auditoria e segurança (RLS)
-- =====================================================================

-- Preenche criado_por/atualizado_por com o usuário logado (auth.uid()).
-- Na rotina automática (chave de serviço) auth.uid() é nulo = "sistema".
create or replace function public.definir_autoria()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.criado_por := coalesce(new.criado_por, auth.uid());
    new.criado_em := now();
  else
    new.criado_por := old.criado_por;
    new.criado_em := old.criado_em;
    new.atualizado_por := auth.uid();
    new.atualizado_em := now();
  end if;
  return new;
end;
$$;

-- Grava uma linha em auditoria para cada inclusão, edição ou exclusão.
-- Em lançamentos, preencher excluido_em conta como "excluiu".
create or replace function public.registrar_auditoria()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  acao text;
  antes jsonb := case when tg_op <> 'INSERT' then to_jsonb(old) end;
  depois jsonb := case when tg_op <> 'DELETE' then to_jsonb(new) end;
begin
  acao := case tg_op when 'INSERT' then 'criou' when 'DELETE' then 'excluiu' else 'editou' end;
  if tg_op = 'UPDATE'
     and antes ->> 'excluido_em' is null
     and depois ->> 'excluido_em' is not null then
    acao := 'excluiu';
  end if;
  insert into public.auditoria (tabela, registro_id, acao, usuario_id, antes, depois)
  values (tg_table_name, coalesce(depois ->> 'id', antes ->> 'id')::uuid, acao, auth.uid(), antes, depois);
  return null;
end;
$$;

-- Marca a exclusão lógica de um lançamento com o usuário que excluiu.
create or replace function public.definir_exclusao()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.excluido_em is not null then
    raise exception 'Lançamento já excluído não pode ser alterado';
  end if;
  if new.excluido_em is not null then
    new.excluido_por := auth.uid();
  end if;
  return new;
end;
$$;

do $$
declare
  t text;
begin
  foreach t in array array['clientes', 'produtos', 'vendas', 'mensalidades', 'gastos_recorrentes', 'lancamentos']
  loop
    execute format(
      'create trigger autoria before insert or update on public.%I
       for each row execute function public.definir_autoria()', t);
  end loop;

  foreach t in array array['clientes', 'produtos', 'vendas', 'mensalidades', 'reajustes',
                           'gastos_recorrentes', 'lancamentos', 'pausas_lembrete']
  loop
    execute format(
      'create trigger auditoria after insert or update or delete on public.%I
       for each row execute function public.registrar_auditoria()', t);
  end loop;
end;
$$;

create trigger exclusao before update on public.lancamentos
for each row execute function public.definir_exclusao();

-- ---------------------------------------------------------------------
-- RLS: só usuários logados (os 2 sócios têm acesso total).
-- Visitantes anônimos não têm acesso a nada.
-- ---------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array['usuarios', 'clientes', 'produtos', 'vendas', 'mensalidades', 'ipca_mensal',
                           'reajustes', 'gastos_recorrentes', 'lancamentos', 'pausas_lembrete',
                           'lembretes_enviados', 'documentos', 'backups', 'auditoria']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon', t);
  end loop;

  -- Acesso total (leitura e escrita) para usuários logados
  foreach t in array array['clientes', 'produtos', 'vendas', 'mensalidades', 'ipca_mensal',
                           'reajustes', 'gastos_recorrentes', 'pausas_lembrete', 'documentos']
  loop
    execute format(
      'create policy acesso_logado on public.%I for all to authenticated using (true) with check (true)', t);
  end loop;

  -- Somente leitura para logados; escrita só pelo servidor (chave de serviço)
  foreach t in array array['usuarios', 'lembretes_enviados', 'backups', 'auditoria']
  loop
    execute format(
      'create policy leitura_logado on public.%I for select to authenticated using (true)', t);
  end loop;
end;
$$;

-- Lançamentos: logados leem, incluem e alteram, mas não apagam de verdade
-- (a exclusão é lógica, preenchendo excluido_em).
create policy leitura_logado on public.lancamentos for select to authenticated using (true);
create policy inclusao_logado on public.lancamentos for insert to authenticated with check (excluido_em is null);
create policy alteracao_logado on public.lancamentos for update to authenticated using (true) with check (true);
revoke delete on public.lancamentos from authenticated;

revoke all on public.v_lancamentos from anon;
revoke execute on function public.criar_perfil_usuario() from anon, authenticated;
revoke execute on function public.registrar_auditoria() from anon, authenticated;

-- >>> 20261027000003_carga_produtos.sql
-- Carga inicial da tabela de produtos (valores em centavos).
insert into public.produtos (nome, preco_centavos, mensalidade_centavos) values
  ('Automação simples', 40000, 20000),
  ('Landing page', 60000, 15000),
  ('Integração (API, pagamento, ERP)', 100000, 30000),
  ('Site institucional', 120000, 20000),
  ('E-commerce', 300000, 50000),
  ('Software / app sob medida', 500000, 70000);

-- >>> 20261027000004_clientes_situacao.sql
-- =====================================================================
-- Clientes: situação da mensalidade, pausa vigente e reativação
-- =====================================================================

-- Uma pausa está vigente em "hoje" se já começou, ainda não chegou à data
-- final e não foi retomada manualmente.
create or replace function public.pausa_vigente_ate(p_cliente_id uuid)
returns date
language sql
stable
security invoker
set search_path = ''
as $$
  select max(p.fim)
  from public.pausas_lembrete p
  where p.cliente_id = p_cliente_id
    and p.inicio <= public.hoje()
    and public.hoje() < coalesce(p.retomado_em, p.fim);
$$;

-- Lista de clientes com a situação calculada:
-- "em_atraso" = alguma mensalidade do cliente tem cobrança atrasada.
create view public.v_clientes
with (security_invoker = true)
as
select
  c.*,
  exists (
    select 1
    from public.v_lancamentos l
    where l.cliente_id = c.id
      and l.mensalidade_id is not null
      and l.status_efetivo = 'atrasado'
  ) as em_atraso,
  public.pausa_vigente_ate(c.id) as lembretes_pausados_ate
from public.clientes c;

revoke all on public.v_clientes from anon;

-- Ao reativar um cliente, guarda a data: cobranças com vencimento anterior
-- (período em que ficou inativo) não são geradas.
create or replace function public.registrar_reativacao()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.ativo = false and new.ativo = true then
    new.reativado_em := public.hoje();
  end if;
  return new;
end;
$$;

create trigger reativacao before update on public.clientes
for each row execute function public.registrar_reativacao();

-- >>> 20261027000005_lancamentos.sql
-- =====================================================================
-- Lançamento de vendas (atômico) e consistência das parcelas
-- =====================================================================

-- O valor de uma venda única passa a acompanhar a soma das parcelas ativas
-- (se uma parcela for editada ou excluída, o total da venda se ajusta).
alter table public.vendas drop constraint vendas_valor_centavos_check;
alter table public.vendas add constraint vendas_valor_centavos_check check (valor_centavos >= 0);

create or replace function public.sincronizar_total_venda()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_venda uuid := coalesce(new.venda_id, old.venda_id);
begin
  if v_venda is not null then
    update public.vendas v
    set valor_centavos = coalesce((
      select sum(l.valor_centavos)
      from public.lancamentos l
      where l.venda_id = v_venda and l.excluido_em is null
    ), 0)
    where v.id = v_venda and v.tipo = 'unica';
  end if;
  return null;
end;
$$;

create trigger total_venda
after update of valor_centavos, excluido_em on public.lancamentos
for each row
when (new.venda_id is not null)
execute function public.sincronizar_total_venda();

-- Registra uma venda completa numa única transação: venda única (com suas
-- parcelas) e/ou mensalidade. Se qualquer parte falhar, nada é gravado.
--
-- p = {
--   cliente_id, produto_id, data_venda,
--   unica: { valor, valor_tabela, forma_pagamento, parcelas: [{ valor, vencimento }] } | null,
--   mensalidade: { valor, valor_tabela, dia_vencimento, data_inicio, forma_pagamento } | null
-- }
create or replace function public.registrar_venda(p jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_cliente public.clientes;
  v_produto public.produtos;
  v_unica jsonb := nullif(p -> 'unica', 'null'::jsonb);
  v_mensal jsonb := nullif(p -> 'mensalidade', 'null'::jsonb);
  v_venda_id uuid;
  v_mensalidade_id uuid;
  v_parcela jsonb;
  v_numero int := 0;
  v_total_parcelas int;
  v_soma bigint := 0;
  v_resultado jsonb := '{}'::jsonb;
begin
  if v_unica is null and v_mensal is null then
    raise exception 'Informe a venda única, a mensalidade ou as duas.';
  end if;

  select * into v_cliente from public.clientes where id = (p ->> 'cliente_id')::uuid;
  if not found then raise exception 'Cliente não encontrado.'; end if;
  if not v_cliente.ativo then raise exception 'Cliente inativo não pode receber vendas novas.'; end if;

  select * into v_produto from public.produtos where id = (p ->> 'produto_id')::uuid;
  if not found then raise exception 'Produto não encontrado.'; end if;
  if not v_produto.ativo then raise exception 'Produto desativado não pode ser vendido.'; end if;

  if v_unica is not null then
    v_total_parcelas := jsonb_array_length(v_unica -> 'parcelas');
    if v_total_parcelas < 1 then raise exception 'Informe ao menos uma parcela.'; end if;
    select sum((x ->> 'valor')::bigint) into v_soma from jsonb_array_elements(v_unica -> 'parcelas') x;
    if v_soma <> (v_unica ->> 'valor')::bigint then
      raise exception 'A soma das parcelas (%) é diferente do valor da venda (%).', v_soma, (v_unica ->> 'valor')::bigint;
    end if;

    insert into public.vendas (cliente_id, produto_id, tipo, valor_tabela_centavos, valor_centavos, data_venda)
    values (v_cliente.id, v_produto.id, 'unica', (v_unica ->> 'valor_tabela')::bigint,
            (v_unica ->> 'valor')::bigint, (p ->> 'data_venda')::date)
    returning id into v_venda_id;

    for v_parcela in select * from jsonb_array_elements(v_unica -> 'parcelas') loop
      v_numero := v_numero + 1;
      insert into public.lancamentos (tipo, descricao, valor_centavos, forma_pagamento, vencimento,
                                      cliente_id, venda_id, parcela)
      values ('entrada',
              v_produto.nome || case when v_total_parcelas > 1
                                     then ' (parcela ' || v_numero || '/' || v_total_parcelas || ')' else '' end,
              (v_parcela ->> 'valor')::bigint, v_unica ->> 'forma_pagamento',
              (v_parcela ->> 'vencimento')::date, v_cliente.id, v_venda_id, v_numero);
    end loop;
    v_resultado := v_resultado || jsonb_build_object('venda_unica_id', v_venda_id);
  end if;

  if v_mensal is not null then
    insert into public.vendas (cliente_id, produto_id, tipo, valor_tabela_centavos, valor_centavos, data_venda)
    values (v_cliente.id, v_produto.id, 'mensalidade', (v_mensal ->> 'valor_tabela')::bigint,
            (v_mensal ->> 'valor')::bigint, (p ->> 'data_venda')::date)
    returning id into v_venda_id;

    insert into public.mensalidades (venda_id, cliente_id, produto_id, valor_inicial_centavos, valor_atual_centavos,
                                     dia_vencimento, data_inicio, forma_pagamento)
    values (v_venda_id, v_cliente.id, v_produto.id, (v_mensal ->> 'valor')::bigint, (v_mensal ->> 'valor')::bigint,
            (v_mensal ->> 'dia_vencimento')::smallint, (v_mensal ->> 'data_inicio')::date,
            v_mensal ->> 'forma_pagamento')
    returning id into v_mensalidade_id;
    v_resultado := v_resultado || jsonb_build_object('mensalidade_id', v_mensalidade_id);
  end if;

  return v_resultado;
end;
$$;

revoke execute on function public.registrar_venda(jsonb) from anon;
revoke execute on function public.sincronizar_total_venda() from anon, authenticated;

-- >>> 20261027000006_cobrancas_reajuste.sql
-- =====================================================================
-- Cobranças, cancelamento de mensalidade e reajuste IPCA
-- =====================================================================

-- Mensalidade cancelada não volta a ficar ativa, e o cancelamento registra
-- data e usuário automaticamente.
create or replace function public.controlar_cancelamento()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.status = 'cancelada' and new.status <> 'cancelada' then
    raise exception 'Mensalidade cancelada não pode ser reativada. Lance uma venda nova.';
  end if;
  if old.status = 'ativa' and new.status = 'cancelada' then
    new.cancelada_em := public.hoje();
    new.cancelada_por := auth.uid();
  end if;
  -- valor_atual só muda pelo reajuste (função aplicar_reajuste)
  if new.valor_atual_centavos <> old.valor_atual_centavos
     and coalesce(current_setting('app.aplicando_reajuste', true), '') <> 'sim' then
    raise exception 'O valor da mensalidade só muda pelo reajuste anual do IPCA.';
  end if;
  return new;
end;
$$;

create trigger cancelamento before update on public.mensalidades
for each row execute function public.controlar_cancelamento();

-- Aplica um reajuste: grava o histórico e atualiza o valor atual, numa única
-- transação. Recusa se o valor mudou desde o cálculo (evita aplicar duas vezes).
--
-- p = { mensalidade_id, aniversario, vale_a_partir_de (AAAA-MM-01), janela_inicio, janela_fim,
--       indice_percentual, indice_aplicado, fonte, valor_anterior, valor_novo }
create or replace function public.aplicar_reajuste(p jsonb)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_id uuid;
  v_atualizadas int;
begin
  perform set_config('app.aplicando_reajuste', 'sim', true);
  update public.mensalidades
  set valor_atual_centavos = (p ->> 'valor_novo')::bigint
  where id = (p ->> 'mensalidade_id')::uuid
    and status = 'ativa'
    and valor_atual_centavos = (p ->> 'valor_anterior')::bigint;
  get diagnostics v_atualizadas = row_count;
  perform set_config('app.aplicando_reajuste', '', true);
  if v_atualizadas = 0 then
    raise exception 'Mensalidade não está ativa ou o valor mudou; reajuste não aplicado.';
  end if;

  insert into public.reajustes (mensalidade_id, aniversario, aplicado_em, vale_a_partir_de, janela_inicio,
                                janela_fim, indice_percentual, indice_aplicado, fonte, valor_anterior_centavos,
                                valor_novo_centavos, registrado_por)
  values ((p ->> 'mensalidade_id')::uuid, (p ->> 'aniversario')::smallint, public.hoje(),
          (p ->> 'vale_a_partir_de')::date, (p ->> 'janela_inicio')::date, (p ->> 'janela_fim')::date,
          (p ->> 'indice_percentual')::numeric, (p ->> 'indice_aplicado')::numeric, p ->> 'fonte',
          (p ->> 'valor_anterior')::bigint, (p ->> 'valor_novo')::bigint, auth.uid())
  returning id into v_id;
  return v_id;
end;
$$;

revoke execute on function public.aplicar_reajuste(jsonb) from anon;

-- >>> 20261027000007_pausas_lembrete.sql
-- =====================================================================
-- Pausar e retomar lembretes de um cliente
-- A pausa vale para todos os lembretes do cliente (todos os canais e
-- mensalidades) até o dia anterior à data final; não altera cobranças.
-- =====================================================================

create or replace function public.pausar_lembretes(p_cliente_id uuid, p_fim date, p_motivo text)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_id uuid;
begin
  -- trava o cliente para evitar duas pausas simultâneas
  perform 1 from public.clientes where id = p_cliente_id for update;
  if not found then raise exception 'Cliente não encontrado.'; end if;
  if p_fim is null or p_fim <= public.hoje() then
    raise exception 'A data final da pausa precisa ser depois de hoje.';
  end if;
  if public.pausa_vigente_ate(p_cliente_id) is not null then
    raise exception 'Os lembretes deste cliente já estão pausados.';
  end if;
  insert into public.pausas_lembrete (cliente_id, inicio, fim, motivo, criado_por)
  values (p_cliente_id, public.hoje(), p_fim, nullif(trim(p_motivo), ''), auth.uid())
  returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.retomar_lembretes(p_cliente_id uuid)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  update public.pausas_lembrete
  set retomado_em = public.hoje(), retomado_por = auth.uid()
  where cliente_id = p_cliente_id
    and inicio <= public.hoje()
    and public.hoje() < coalesce(retomado_em, fim);
  if not found then
    raise exception 'Os lembretes deste cliente não estão pausados.';
  end if;
end;
$$;

revoke execute on function public.pausar_lembretes(uuid, date, text) from anon;
revoke execute on function public.retomar_lembretes(uuid) from anon;

-- >>> 20261027000008_documentos.sql
-- =====================================================================
-- Documentos internos: espaço privado no Supabase Storage
-- Só usuários logados enviam, listam, abrem, baixam e excluem.
-- (O bloco só roda onde o Storage existe; nos testes locais em memória não.)
-- =====================================================================
do $$
begin
  if to_regclass('storage.buckets') is not null and to_regclass('storage.objects') is not null then
    insert into storage.buckets (id, name, public, file_size_limit)
    values ('documentos', 'documentos', false, 52428800) -- 50 MB por arquivo (limite do plano gratuito)
    on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit;

    execute $p$create policy documentos_leitura on storage.objects for select to authenticated
             using (bucket_id = 'documentos')$p$;
    execute $p$create policy documentos_envio on storage.objects for insert to authenticated
             with check (bucket_id = 'documentos')$p$;
    execute $p$create policy documentos_exclusao on storage.objects for delete to authenticated
             using (bucket_id = 'documentos')$p$;
  end if;
end;
$$;

-- >>> 20261027000009_backup.sql
-- =====================================================================
-- Backup e restauração dos dados
-- Exporta todas as tabelas de negócio em um JSON (retrato consistente) e
-- restaura numa única transação: ou volta tudo, ou nada muda.
-- Só a chave de serviço (servidor) executa essas funções.
-- Os usuários (login) não entram na restauração: continuam os atuais.
-- =====================================================================

-- Ordem respeita as dependências (pais antes dos filhos)
create or replace function public.tabelas_backup()
returns text[]
language sql
immutable
as $$
  select array['produtos', 'clientes', 'vendas', 'mensalidades', 'ipca_mensal', 'reajustes', 'gastos_recorrentes',
               'lancamentos', 'pausas_lembrete', 'lembretes_enviados', 'documentos', 'auditoria'];
$$;

create or replace function public.exportar_backup()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_tabela text;
  v_dados jsonb := '{}'::jsonb;
  v_linhas jsonb;
begin
  foreach v_tabela in array public.tabelas_backup() || array['usuarios'] loop
    execute format('select coalesce(jsonb_agg(to_jsonb(t)), ''[]''::jsonb) from public.%I t', v_tabela) into v_linhas;
    v_dados := v_dados || jsonb_build_object(v_tabela, v_linhas);
  end loop;
  return jsonb_build_object('sistema', 'movcode-gestao', 'versao', 1, 'gerado_em', now(), 'tabelas', v_dados);
end;
$$;

create or replace function public.restaurar_backup(p jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tabela text;
  v_colunas text;
  v_tabelas text[] := public.tabelas_backup();
  v_contagem jsonb := '{}'::jsonb;
  v_n int;
  i int;
begin
  if p ->> 'sistema' is distinct from 'movcode-gestao' or (p ->> 'versao')::int is distinct from 1 then
    raise exception 'Arquivo não é um backup válido deste sistema.';
  end if;
  foreach v_tabela in array v_tabelas loop
    if jsonb_typeof(p -> 'tabelas' -> v_tabela) is distinct from 'array' then
      raise exception 'Backup incompleto: falta a tabela %.', v_tabela;
    end if;
  end loop;

  -- Os gatilhos (autoria, auditoria, regras) ficam desligados durante a carga:
  -- os registros voltam exatamente como estavam no backup.
  foreach v_tabela in array v_tabelas loop
    execute format('alter table public.%I disable trigger user', v_tabela);
  end loop;

  -- Apaga dos filhos para os pais
  for i in reverse array_length(v_tabelas, 1)..1 loop
    -- "where true": o Supabase bloqueia DELETE sem WHERE em chamadas pela API (pg_safeupdate)
    execute format('delete from public.%I where true', v_tabelas[i]);
  end loop;

  -- Recarrega dos pais para os filhos (colunas calculadas ficam de fora)
  foreach v_tabela in array v_tabelas loop
    select string_agg(quote_ident(column_name), ', ' order by ordinal_position) into v_colunas
    from information_schema.columns
    where table_schema = 'public' and table_name = v_tabela and is_generated = 'NEVER';
    execute format(
      'insert into public.%1$I (%2$s) overriding system value select %2$s from jsonb_populate_recordset(null::public.%1$I, $1)',
      v_tabela, v_colunas)
    using p -> 'tabelas' -> v_tabela;
    get diagnostics v_n = row_count;
    v_contagem := v_contagem || jsonb_build_object(v_tabela, v_n);
  end loop;

  foreach v_tabela in array v_tabelas loop
    execute format('alter table public.%I enable trigger user', v_tabela);
  end loop;

  -- Continua a numeração da auditoria depois do maior id restaurado
  perform setval(pg_get_serial_sequence('public.auditoria', 'id'), coalesce((select max(id) from public.auditoria), 0) + 1, false);
  return v_contagem;
end;
$$;

revoke execute on function public.exportar_backup() from public, anon, authenticated;
revoke execute on function public.restaurar_backup(jsonb) from public, anon, authenticated;
grant execute on function public.exportar_backup() to service_role;
grant execute on function public.restaurar_backup(jsonb) to service_role;

-- Espaço privado para os arquivos de backup (só a chave de serviço acessa)
do $$
begin
  if to_regclass('storage.buckets') is not null and to_regclass('storage.objects') is not null then
    insert into storage.buckets (id, name, public)
    values ('backups', 'backups', false)
    on conflict (id) do update set public = false;
  end if;
end;
$$;

-- >>> 20261028000010_prospeccao.sql
-- =====================================================================
-- Prospecção: leads do Instagram (antes no painel "Prospecção MovCode")
-- A rotina de busca grava os leads novos pela API /api/prospeccao/rotina;
-- os 2 sócios abordam, registram os follow-ups e acompanham o funil.
-- =====================================================================

create table public.leads (
  id uuid primary key default gen_random_uuid(),
  -- @ do Instagram, em minúsculas e sem o "@": um lead por perfil
  instagram text not null unique check (instagram ~ '^[a-z0-9._]{1,30}$'),
  nome text not null check (length(trim(nome)) > 0),
  nicho text not null default '',
  cidade text not null default '',
  etapa text not null default 'novo'
    check (etapa in ('novo', 'abordado', 'respondeu', 'reuniao', 'proposta', 'fechado', 'perdido')),
  -- Nota de 0 a 100: quanto maior, melhor o lead
  nota smallint not null default 60 check (nota between 0 and 100),
  site_situacao text not null default '',
  -- Endereços só http(s): viram links na tela
  site_url text not null default '' check (site_url = '' or site_url ~* '^https?://'),
  link_previa text not null default '' check (link_previa = '' or link_previa ~* '^https?://'),
  whatsapp text not null default '',
  motivo text not null default '',
  dor text not null default '',
  servico text not null default '',
  -- Textos prontos para copiar e colar no Instagram
  mensagem text not null default '',
  followup1 text not null default '',
  followup2 text not null default '',
  resposta_sim text not null default '',
  perfil_conferido boolean not null default false,
  responsavel_id uuid references public.usuarios (id) on delete set null,
  abordado_em timestamptz,
  proximo_followup timestamptz,
  followups_enviados smallint not null default 0 check (followups_enviados between 0 and 2),
  ultimo_followup_em timestamptz,
  respondeu_em timestamptz,
  notas text not null default '',
  -- De onde veio (consulta usada na busca, "manual" ou "painel antigo")
  fonte text not null default '',
  -- Quando o lead foi encontrado (pode ser anterior ao cadastro, nos importados)
  encontrado_em timestamptz not null default now(),
  -- Cliente cadastrado a partir deste lead
  cliente_id uuid references public.clientes (id) on delete set null,
  criado_por uuid references public.usuarios (id) on delete set null,
  criado_em timestamptz not null default now(),
  atualizado_por uuid references public.usuarios (id) on delete set null,
  atualizado_em timestamptz
);

-- O que a rotina de busca procura (uma linha só) e o resultado da última busca
create table public.prospeccao_config (
  id boolean primary key default true check (id),
  cidades text[] not null default '{}',
  nichos text[] not null default '{}',
  leads_por_dia smallint not null default 8 check (leads_por_dia between 1 and 30),
  assinatura text not null default '',
  instrucoes text not null default '',
  ultima_busca_em timestamptz,
  ultima_busca_adicionados int,
  criado_por uuid references public.usuarios (id) on delete set null,
  criado_em timestamptz not null default now(),
  atualizado_por uuid references public.usuarios (id) on delete set null,
  atualizado_em timestamptz
);

insert into public.prospeccao_config (cidades, nichos, leads_por_dia, assinatura, instrucoes)
values (
  array['Ribeirão Preto'],
  array['hamburgueria', 'marmitaria', 'pet shop', 'barbearia', 'estúdio de pilates', 'clínica de estética',
        'depósito de bebidas', 'material de construção'],
  8,
  'Kaique, da MovCode',
  'Oferecer o diagnóstico gratuito de 30 min. Tom coloquial e direto, sem jargão.'
);

-- Quantos leads há em cada etapa do funil
create view public.v_leads_por_etapa
with (security_invoker = true)
as
select etapa, count(*)::int as quantidade
from public.leads
group by etapa;

-- Autoria e auditoria como nas demais tabelas
create trigger autoria before insert or update on public.leads
for each row execute function public.definir_autoria();
create trigger auditoria after insert or update or delete on public.leads
for each row execute function public.registrar_auditoria();
create trigger autoria before insert or update on public.prospeccao_config
for each row execute function public.definir_autoria();

-- RLS: só usuários logados (os 2 sócios têm acesso total)
alter table public.leads enable row level security;
alter table public.prospeccao_config enable row level security;
revoke all on public.leads, public.prospeccao_config, public.v_leads_por_etapa from anon;
create policy acesso_logado on public.leads for all to authenticated using (true) with check (true);
create policy acesso_logado on public.prospeccao_config for all to authenticated using (true) with check (true);
-- A configuração é uma linha só: não se apaga nem se cria outra
revoke delete on public.prospeccao_config from authenticated;

-- ---------------------------------------------------------------------
-- Backup: os leads e a configuração entram no backup
-- ---------------------------------------------------------------------
create or replace function public.tabelas_backup()
returns text[]
language sql
immutable
as $$
  select array['produtos', 'clientes', 'vendas', 'mensalidades', 'ipca_mensal', 'reajustes', 'gastos_recorrentes',
               'lancamentos', 'pausas_lembrete', 'lembretes_enviados', 'documentos', 'leads', 'prospeccao_config',
               'auditoria'];
$$;

-- Igual à versão anterior, mas aceita backups feitos antes da Prospecção existir:
-- nesses, os leads e a configuração atuais ficam como estão.
create or replace function public.restaurar_backup(p jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tabela text;
  v_colunas text;
  v_todas text[] := public.tabelas_backup();
  v_opcionais text[] := array['leads', 'prospeccao_config'];
  v_tabelas text[] := '{}';
  v_contagem jsonb := '{}'::jsonb;
  v_n int;
  i int;
begin
  if p ->> 'sistema' is distinct from 'movcode-gestao' or (p ->> 'versao')::int is distinct from 1 then
    raise exception 'Arquivo não é um backup válido deste sistema.';
  end if;
  foreach v_tabela in array v_todas loop
    if jsonb_typeof(p -> 'tabelas' -> v_tabela) = 'array' then
      v_tabelas := v_tabelas || v_tabela;
    elsif not v_tabela = any (v_opcionais) then
      raise exception 'Backup incompleto: falta a tabela %.', v_tabela;
    end if;
  end loop;

  -- Os gatilhos (autoria, auditoria, regras) ficam desligados durante a carga:
  -- os registros voltam exatamente como estavam no backup. Desliga em todas,
  -- inclusive nas que ficam como estão (a exclusão de clientes limpa o vínculo
  -- dos leads e não deve gerar auditoria no meio da carga).
  foreach v_tabela in array v_todas loop
    execute format('alter table public.%I disable trigger user', v_tabela);
  end loop;

  -- Apaga dos filhos para os pais
  for i in reverse array_length(v_tabelas, 1)..1 loop
    -- "where true": o Supabase bloqueia DELETE sem WHERE em chamadas pela API (pg_safeupdate)
    execute format('delete from public.%I where true', v_tabelas[i]);
  end loop;

  -- Recarrega dos pais para os filhos (colunas calculadas ficam de fora)
  foreach v_tabela in array v_tabelas loop
    select string_agg(quote_ident(column_name), ', ' order by ordinal_position) into v_colunas
    from information_schema.columns
    where table_schema = 'public' and table_name = v_tabela and is_generated = 'NEVER';
    execute format(
      'insert into public.%1$I (%2$s) overriding system value select %2$s from jsonb_populate_recordset(null::public.%1$I, $1)',
      v_tabela, v_colunas)
    using p -> 'tabelas' -> v_tabela;
    get diagnostics v_n = row_count;
    v_contagem := v_contagem || jsonb_build_object(v_tabela, v_n);
  end loop;

  foreach v_tabela in array v_todas loop
    execute format('alter table public.%I enable trigger user', v_tabela);
  end loop;

  -- Continua a numeração da auditoria depois do maior id restaurado
  perform setval(pg_get_serial_sequence('public.auditoria', 'id'), coalesce((select max(id) from public.auditoria), 0) + 1, false);
  return v_contagem;
end;
$$;

revoke execute on function public.restaurar_backup(jsonb) from public, anon, authenticated;
grant execute on function public.restaurar_backup(jsonb) to service_role;
