set lock_timeout = '5s';
set statement_timeout = '60s';

do $$
declare
  t text;
begin
  for t in
    select c.table_name
    from information_schema.columns c
    join information_schema.tables tb on tb.table_schema = c.table_schema and tb.table_name = c.table_name and tb.table_type = 'BASE TABLE'
    where c.table_schema = 'public'
      and c.column_name = 'org_id'
      and c.table_name not in ('orgs_members', 'orgs_invites', 'canvas_events')
  loop
    execute format('drop policy if exists editors_insert on public.%I', t);
    execute format('drop policy if exists editors_update on public.%I', t);
    execute format('drop policy if exists editors_delete on public.%I', t);
    execute format('create policy editors_insert on public.%I as restrictive for insert to authenticated with check (org_id is null or org_id in (select public.auth_editor_org_ids()))', t);
    execute format('create policy editors_update on public.%I as restrictive for update to authenticated using (org_id is null or org_id in (select public.auth_editor_org_ids())) with check (org_id is null or org_id in (select public.auth_editor_org_ids()))', t);
    execute format('create policy editors_delete on public.%I as restrictive for delete to authenticated using (org_id is null or org_id in (select public.auth_editor_org_ids()))', t);
  end loop;

  if to_regclass('public.post_sources') is not null and to_regclass('public.posts') is not null then
    drop policy if exists editors_write on public.post_sources;
    create policy editors_write on public.post_sources as restrictive for all to authenticated
      using (exists (select 1 from public.posts p where p.id = post_sources.post_id and p.org_id in (select public.auth_editor_org_ids())))
      with check (exists (select 1 from public.posts p where p.id = post_sources.post_id and p.org_id in (select public.auth_editor_org_ids())));
  end if;
end $$;

create or replace function public.storage_write_allowed(bucket text, object_name text) returns boolean
language plpgsql stable security invoker set search_path = '' as $$
declare
  uuid_shape constant text := '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';
  first text := (storage.foldername(object_name))[1];
  second text := (storage.foldername(object_name))[2];
  editor_orgs uuid[] := array(select public.auth_editor_org_ids());
begin
  if bucket = 'canvas-assets' then
    return case when first ~* uuid_shape then first::uuid = any(editor_orgs) else false end;
  end if;

  if bucket = 'influencers' then
    return first = 'catalogue' or case when first ~* uuid_shape then first::uuid = any(editor_orgs) else false end;
  end if;

  if bucket = 'embeds' then
    if split_part(object_name, '.', 1) !~* uuid_shape then
      return false;
    end if;
    return exists (select 1 from public.nodes n where n.id = split_part(object_name, '.', 1)::uuid and n.org_id = any(editor_orgs));
  end if;

  if bucket = 'media' and first = 'colours' then
    return case when second ~* uuid_shape then second::uuid = any(editor_orgs) else false end;
  end if;

  if bucket = 'media' and first ~* uuid_shape and first <> auth.uid()::text then
    return not exists (select 1 from public.brands b where b.id = first::uuid)
      or exists (select 1 from public.brands b where b.id = first::uuid and b.org_id = any(editor_orgs));
  end if;

  return true;
end $$;

revoke execute on function public.storage_write_allowed(text, text) from public, anon;
grant execute on function public.storage_write_allowed(text, text) to authenticated;

drop policy if exists "org files editors insert" on storage.objects;
drop policy if exists "org files editors update" on storage.objects;
drop policy if exists "org files editors delete" on storage.objects;

create policy "org files editors insert" on storage.objects as restrictive for insert to authenticated
  with check (public.storage_write_allowed(bucket_id, name));
create policy "org files editors update" on storage.objects as restrictive for update to authenticated
  using (public.storage_write_allowed(bucket_id, name))
  with check (public.storage_write_allowed(bucket_id, name));
create policy "org files editors delete" on storage.objects as restrictive for delete to authenticated
  using (public.storage_write_allowed(bucket_id, name));
