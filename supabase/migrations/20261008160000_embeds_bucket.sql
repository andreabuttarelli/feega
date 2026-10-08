begin;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('embeds', 'embeds', true, 67108864, array['text/html'])
on conflict (id) do update set public = true, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

create or replace function public.embed_node_writable(object_name text)
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select case
    when object_name ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.html$' then exists (
      select 1 from public.nodes n
      where n.id = (split_part(object_name, '.', 1))::uuid
        and n.deleted_at is null
        and n.org_id in (select public.auth_org_ids())
    )
    else false
  end;
$$;

drop policy if exists "embeds select own org" on storage.objects;
create policy "embeds select own org" on storage.objects for select to authenticated
  using (bucket_id = 'embeds' and public.embed_node_writable(name));

drop policy if exists "embeds insert own org" on storage.objects;
create policy "embeds insert own org" on storage.objects for insert to authenticated
  with check (bucket_id = 'embeds' and public.embed_node_writable(name));

drop policy if exists "embeds update own org" on storage.objects;
create policy "embeds update own org" on storage.objects for update to authenticated
  using (bucket_id = 'embeds' and public.embed_node_writable(name))
  with check (bucket_id = 'embeds' and public.embed_node_writable(name));

drop policy if exists "embeds delete own org" on storage.objects;
create policy "embeds delete own org" on storage.objects for delete to authenticated
  using (bucket_id = 'embeds' and public.embed_node_writable(name));

commit;
