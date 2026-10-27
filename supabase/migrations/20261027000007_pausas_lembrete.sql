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
