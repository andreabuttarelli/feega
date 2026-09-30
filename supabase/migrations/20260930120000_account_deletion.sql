create table if not exists public.account_deletions (
  id uuid primary key default gen_random_uuid(),
  deleted_at timestamptz not null default now(),
  orgs_deleted integer not null,
  orgs_kept integer not null
);

alter table public.account_deletions enable row level security;

create or replace function public.delete_account(p_user uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_blocked uuid[];
  v_delete uuid[];
  v_kept integer;
begin
  select coalesce(array_agg(m.org_id), '{}') into v_blocked
  from orgs_members m
  where m.user_id = p_user
    and m.role = 'owner'
    and not exists (select 1 from orgs_members o where o.org_id = m.org_id and o.user_id <> p_user and o.role = 'owner')
    and exists (select 1 from orgs_members o where o.org_id = m.org_id and o.user_id <> p_user);

  if cardinality(v_blocked) > 0 then
    return jsonb_build_object('status', 'transfer_required', 'org_ids', to_jsonb(v_blocked));
  end if;

  select coalesce(array_agg(m.org_id), '{}') into v_delete
  from orgs_members m
  where m.user_id = p_user
    and not exists (select 1 from orgs_members o where o.org_id = m.org_id and o.user_id <> p_user);

  select count(*) into v_kept from orgs_members m where m.user_id = p_user and not (m.org_id = any(v_delete));

  delete from orgs where id = any(v_delete);

  delete from chat_threads where created_by = p_user;
  delete from org_uncensored_optins where enabled_by = p_user;
  update org_uncensored_optins set disabled_by = null where disabled_by = p_user;
  update orgs_invites set invited_by = null where invited_by = p_user;
  update nodes set actor_id = null where actor_id = p_user;
  update nodes set lock_actor_id = null where lock_actor_id = p_user;
  update nodes_connections set actor_id = null where actor_id = p_user;
  update node_runs set actor_id = null where actor_id = p_user;
  update posts set actor_id = null where actor_id = p_user;
  update ad_campaigns set actor_id = null where actor_id = p_user;
  update ad_campaigns set approved_by = null where approved_by = p_user;
  update ai_calls set actor_id = null where actor_id = p_user;
  update chat_messages set actor_id = null where actor_id = p_user;
  update canvas_events set actor_id = null where actor_id = p_user;
  update influencers set actor_id = null where actor_id = p_user;
  update moderation_checks set actor_id = null where actor_id = p_user;

  insert into account_deletions (orgs_deleted, orgs_kept) values (cardinality(v_delete), v_kept);

  delete from auth.users where id = p_user;

  return jsonb_build_object('status', 'deleted', 'org_ids', to_jsonb(v_delete));
end;
$$;

revoke all on function public.delete_account(uuid) from public, anon, authenticated;
grant execute on function public.delete_account(uuid) to service_role;
