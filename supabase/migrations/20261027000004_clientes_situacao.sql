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
