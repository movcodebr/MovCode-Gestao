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
