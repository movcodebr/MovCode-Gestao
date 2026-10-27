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
