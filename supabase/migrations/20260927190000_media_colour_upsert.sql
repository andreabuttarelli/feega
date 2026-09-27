begin;

drop policy if exists "media select own colour" on storage.objects;
create policy "media select own colour" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'media'
    and (storage.foldername(name))[1] = 'colours'
    and case
      when (storage.foldername(name))[2] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        then ((storage.foldername(name))[2])::uuid
      else null::uuid
    end in (select public.auth_org_ids())
  );

drop policy if exists "media update own colour" on storage.objects;
create policy "media update own colour" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'media'
    and (storage.foldername(name))[1] = 'colours'
    and case
      when (storage.foldername(name))[2] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        then ((storage.foldername(name))[2])::uuid
      else null::uuid
    end in (select public.auth_org_ids())
  )
  with check (
    bucket_id = 'media'
    and (storage.foldername(name))[1] = 'colours'
    and case
      when (storage.foldername(name))[2] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        then ((storage.foldername(name))[2])::uuid
      else null::uuid
    end in (select public.auth_org_ids())
  );

commit;
