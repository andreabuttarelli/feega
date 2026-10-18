set lock_timeout = '5s';
set statement_timeout = '60s';

alter table public.orgs_members drop constraint if exists orgs_members_role_check;
alter table public.orgs_members add constraint orgs_members_role_check check (role in ('owner', 'admin', 'member', 'viewer'));

alter table public.orgs_invites drop constraint if exists orgs_invites_role_check;
alter table public.orgs_invites add constraint orgs_invites_role_check check (role in ('owner', 'admin', 'member', 'viewer'));

create or replace function public.auth_editor_org_ids() returns setof uuid
language sql stable security definer set search_path = public as $$
  select org_id from public.orgs_members where user_id = auth.uid() and role in ('owner', 'admin', 'member')
$$;

create or replace function public.auth_admin_org_ids() returns setof uuid
language sql stable security definer set search_path = public as $$
  select org_id from public.orgs_members where user_id = auth.uid() and role in ('owner', 'admin')
$$;

revoke execute on function public.auth_editor_org_ids() from public, anon;
revoke execute on function public.auth_admin_org_ids() from public, anon;
grant execute on function public.auth_editor_org_ids() to authenticated;
grant execute on function public.auth_admin_org_ids() to authenticated;

do $$
declare
  t text;
begin
  for t in
    select p.tablename
    from pg_policies p
    join information_schema.columns c on c.table_schema = p.schemaname and c.table_name = p.tablename and c.column_name = 'org_id'
    where p.schemaname = 'public'
      and p.policyname = 'org_isolation'
      and p.tablename not in ('orgs_members', 'orgs_invites', 'canvas_events')
  loop
    execute format('drop policy org_isolation on public.%I', t);
    execute format('create policy org_read on public.%I for select using (org_id in (select public.auth_org_ids()))', t);
    execute format('create policy org_insert on public.%I for insert with check (org_id in (select public.auth_editor_org_ids()))', t);
    execute format('create policy org_update on public.%I for update using (org_id in (select public.auth_editor_org_ids())) with check (org_id in (select public.auth_editor_org_ids()))', t);
    execute format('create policy org_delete on public.%I for delete using (org_id in (select public.auth_editor_org_ids()))', t);
  end loop;
end $$;

drop policy if exists org_isolation on public.orgs_members;
create policy members_read on public.orgs_members for select using (org_id in (select public.auth_org_ids()));
create policy members_update on public.orgs_members for update
  using (org_id in (select public.auth_admin_org_ids()) and role <> 'owner')
  with check (org_id in (select public.auth_admin_org_ids()) and role <> 'owner');
create policy members_delete on public.orgs_members for delete
  using (role <> 'owner' and (user_id = auth.uid() or org_id in (select public.auth_admin_org_ids())));

drop policy if exists org_isolation on public.orgs_invites;
create policy invites_read on public.orgs_invites for select using (org_id in (select public.auth_admin_org_ids()));
create policy invites_insert on public.orgs_invites for insert with check (org_id in (select public.auth_admin_org_ids()) and role <> 'owner');
create policy invites_update on public.orgs_invites for update
  using (org_id in (select public.auth_admin_org_ids()))
  with check (org_id in (select public.auth_admin_org_ids()) and role <> 'owner');
create policy invites_delete on public.orgs_invites for delete using (org_id in (select public.auth_admin_org_ids()));

create or replace function public.transfer_org_ownership(p_org uuid, p_to uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from orgs_members where org_id = p_org and user_id = auth.uid() and role = 'owner') then
    raise exception 'not_owner' using errcode = '42501';
  end if;
  if p_to = auth.uid() or not exists (select 1 from orgs_members where org_id = p_org and user_id = p_to) then
    raise exception 'not_member' using errcode = 'P0002';
  end if;

  update orgs_members set role = 'admin' where org_id = p_org and user_id = auth.uid();
  update orgs_members set role = 'owner' where org_id = p_org and user_id = p_to;
end $$;

revoke execute on function public.transfer_org_ownership(uuid, uuid) from public, anon;
grant execute on function public.transfer_org_ownership(uuid, uuid) to authenticated;
