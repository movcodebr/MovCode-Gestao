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
