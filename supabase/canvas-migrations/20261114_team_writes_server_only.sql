begin;

revoke insert, update, delete, truncate, references, trigger on public.orgs from anon, authenticated;
drop policy if exists member_orgs on public.orgs;
drop policy if exists orgs_read on public.orgs;
create policy orgs_read on public.orgs for select to authenticated
  using (id in (select public.auth_org_ids()));

revoke insert, update, truncate, references, trigger on public.orgs_members from anon, authenticated;
drop policy if exists members_update on public.orgs_members;

revoke insert, update, truncate, references, trigger on public.orgs_invites from anon, authenticated;
drop policy if exists invites_insert on public.orgs_invites;
drop policy if exists invites_update on public.orgs_invites;

commit;
