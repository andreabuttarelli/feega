begin;

revoke update, truncate, references, trigger on public.api_keys from anon, authenticated;
drop policy if exists org_update on public.api_keys;
drop policy if exists editors_update on public.api_keys;

drop policy if exists org_insert on public.api_keys;
create policy org_insert on public.api_keys for insert to authenticated
  with check (org_id in (select public.auth_editor_org_ids()) and user_id = auth.uid());

commit;
