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
