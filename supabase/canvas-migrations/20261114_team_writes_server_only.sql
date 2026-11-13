begin;

revoke insert, update, truncate, references, trigger on public.orgs_members from anon, authenticated;
drop policy if exists members_update on public.orgs_members;

revoke insert, update, truncate, references, trigger on public.orgs_invites from anon, authenticated;
drop policy if exists invites_insert on public.orgs_invites;
drop policy if exists invites_update on public.orgs_invites;

commit;
