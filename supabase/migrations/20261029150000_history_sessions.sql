set lock_timeout = '3s';
set statement_timeout = '60s';

alter table public.canvas_events add column if not exists session_id uuid;
alter table public.motion_revisions add column if not exists session_id uuid;

create or replace function public.commit_motion_revision(
  p_org_id uuid,
  p_node_id uuid,
  p_expected integer,
  p_doc jsonb,
  p_summary text,
  p_actor_kind text,
  p_actor_id uuid,
  p_agent_key text,
  p_coalesce_ms integer,
  p_session_id uuid
)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  head public.motion_revisions%rowtype;
begin
  select * into head
  from public.motion_revisions
  where org_id = p_org_id and node_id = p_node_id
  order by version desc
  limit 1
  for update;

  if coalesce(head.version, 0) <> p_expected then
    return null;
  end if;

  if p_coalesce_ms > 0
    and head.id is not null
    and not head.sealed
    and head.actor_kind = p_actor_kind
    and head.actor_id is not distinct from p_actor_id
    and head.agent_key is not distinct from p_agent_key
    and head.session_id is not distinct from p_session_id
    and head.created_at > now() - make_interval(secs => p_coalesce_ms / 1000.0) then
    update public.motion_revisions
    set version = p_expected + 1, doc = p_doc, summary = p_summary, created_at = now()
    where id = head.id;
  else
    insert into public.motion_revisions (org_id, node_id, version, doc, summary, actor_kind, actor_id, agent_key, session_id)
    values (p_org_id, p_node_id, p_expected + 1, p_doc, p_summary, p_actor_kind, p_actor_id, p_agent_key, p_session_id);
  end if;

  return p_expected + 1;
exception
  when unique_violation then
    return null;
end;
$$;

revoke all on function public.commit_motion_revision(uuid, uuid, integer, jsonb, text, text, uuid, text, integer, uuid) from public, anon;
grant execute on function public.commit_motion_revision(uuid, uuid, integer, jsonb, text, text, uuid, text, integer, uuid) to authenticated, service_role;
