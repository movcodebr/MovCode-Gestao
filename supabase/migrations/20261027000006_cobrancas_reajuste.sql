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
