-- =====================================================================
-- Documentos internos: espaço privado no Supabase Storage
-- Só usuários logados enviam, listam, abrem, baixam e excluem.
-- (O bloco só roda onde o Storage existe; nos testes locais em memória não.)
-- =====================================================================
do $$
begin
  if exists (select 1 from information_schema.schemata where schema_name = 'storage') then
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
