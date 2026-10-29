begin;

set local lock_timeout = '5s';
set local statement_timeout = '60s';

create table if not exists public.canvas_conflicts (
  id               uuid primary key default gen_random_uuid(),
  org_id           uuid not null references public.orgs(id) on delete cascade,
  canvas_id        uuid not null references public.canvases(id) on delete cascade,
  node_id          uuid not null references public.nodes(id) on delete cascade,
  expected_version integer,
  actual_version   integer,
  attempt          text not null check (attempt in ('replace', 'patch', 'motion_head')),
  attempted        jsonb not null,
  winning_event_id bigint references public.canvas_events(id) on delete set null,
  actor_kind       text not null check (actor_kind in ('user', 'agent', 'system')),
  actor_id         uuid references public.profiles(id) on delete set null,
  agent_key        text,
  resolution       text check (resolution in ('mine', 'theirs')),
  resolved_at      timestamptz,
  resolved_by      uuid references public.profiles(id) on delete set null,
  created_at       timestamptz not null default now()
);

create index if not exists canvas_conflicts_canvas_idx on public.canvas_conflicts (org_id, canvas_id, created_at desc);
create index if not exists canvas_conflicts_node_idx on public.canvas_conflicts (node_id);
create index if not exists canvas_conflicts_event_idx on public.canvas_conflicts (winning_event_id);
create index if not exists canvas_conflicts_actor_idx on public.canvas_conflicts (actor_id);
create index if not exists canvas_conflicts_resolved_by_idx on public.canvas_conflicts (resolved_by);

alter table public.canvas_conflicts enable row level security;

drop policy if exists "canvas_conflicts own org" on public.canvas_conflicts;
create policy "canvas_conflicts own org" on public.canvas_conflicts
  for all to authenticated
  using (org_id in (select public.auth_org_ids()))
  with check (org_id in (select public.auth_org_ids()));

commit;
