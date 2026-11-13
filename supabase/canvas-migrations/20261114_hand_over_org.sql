begin;

create or replace function public.hand_over_org(p_org uuid, p_from uuid, p_to uuid, p_from_role text) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  moved integer;
begin
  if p_from_role not in ('admin', 'member', 'viewer') then
    raise exception 'invalid_role' using errcode = '22023';
  end if;
  if p_to = p_from then
    raise exception 'not_member' using errcode = 'P0002';
  end if;

  perform 1 from public.orgs_members where org_id = p_org and user_id in (p_from, p_to) for update;

  update public.orgs_members set role = p_from_role where org_id = p_org and user_id = p_from and role = 'owner';
  get diagnostics moved = row_count;
  if moved <> 1 then
    raise exception 'not_owner' using errcode = '42501';
  end if;

  update public.orgs_members set role = 'owner' where org_id = p_org and user_id = p_to;
  get diagnostics moved = row_count;
  if moved <> 1 then
    raise exception 'not_member' using errcode = 'P0002';
  end if;
end;
$$;

revoke all on function public.hand_over_org(uuid, uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.hand_over_org(uuid, uuid, uuid, text) to service_role;

create unique index if not exists orgs_members_one_owner on public.orgs_members (org_id) where role = 'owner';

commit;
