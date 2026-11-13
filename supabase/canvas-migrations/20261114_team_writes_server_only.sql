begin;

revoke insert, update, truncate, references, trigger on public.orgs_members from anon, authenticated;
drop policy if exists members_update on public.orgs_members;

revoke insert, update, truncate, references, trigger on public.orgs_invites from anon, authenticated;
drop policy if exists invites_insert on public.orgs_invites;
drop policy if exists invites_update on public.orgs_invites;

create or replace function public.hand_over_org(p_org uuid, p_from uuid, p_to uuid, p_from_role text) returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_from_role not in ('admin', 'member', 'viewer') then
    raise exception 'invalid_role' using errcode = '22023';
  end if;
  if not exists (select 1 from public.orgs_members where org_id = p_org and user_id = p_from and role = 'owner') then
    raise exception 'not_owner' using errcode = '42501';
  end if;
  if p_to = p_from or not exists (select 1 from public.orgs_members where org_id = p_org and user_id = p_to) then
    raise exception 'not_member' using errcode = 'P0002';
  end if;

  update public.orgs_members set role = p_from_role where org_id = p_org and user_id = p_from;
  update public.orgs_members set role = 'owner' where org_id = p_org and user_id = p_to;
end;
$$;

revoke all on function public.hand_over_org(uuid, uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.hand_over_org(uuid, uuid, uuid, text) to service_role;

revoke execute on function public.transfer_org_ownership(uuid, uuid) from public, anon, authenticated;

commit;
