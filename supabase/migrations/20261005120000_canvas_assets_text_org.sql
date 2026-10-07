drop policy if exists "canvas-assets read own org" on storage.objects;
create policy "canvas-assets read own org" on storage.objects
  for select to authenticated
  using (bucket_id = 'canvas-assets' and (storage.foldername(name))[1] in (select public.auth_org_ids()::text));

drop policy if exists "canvas-assets insert own org" on storage.objects;
create policy "canvas-assets insert own org" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'canvas-assets' and (storage.foldername(name))[1] in (select public.auth_org_ids()::text));

drop policy if exists "canvas-assets delete own org" on storage.objects;
create policy "canvas-assets delete own org" on storage.objects
  for delete to authenticated
  using (bucket_id = 'canvas-assets' and (storage.foldername(name))[1] in (select public.auth_org_ids()::text));
