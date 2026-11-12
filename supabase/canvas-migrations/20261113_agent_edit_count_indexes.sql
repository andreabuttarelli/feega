create index if not exists canvas_events_agent_week_idx
  on public.canvas_events (org_id, created_at)
  where actor_kind = 'agent';

create index if not exists motion_revisions_agent_week_idx
  on public.motion_revisions (org_id, created_at)
  where actor_kind = 'agent';
