begin;

alter table public.nodes drop constraint if exists nodes_type_check;

alter table public.nodes add constraint nodes_type_check check (
  type in (
    'text', 'image', 'video', 'doc', 'iframe',
    'social_account_feed', 'social_post_mockup', 'products', 'ads',
    'influencer', 'list', 'select', 'effects', 'composition', 'calendar',
    'audio', 'model3d', 'motion'
  )
);

create table if not exists public.motion_revisions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs(id) on delete cascade,
  node_id uuid not null references public.nodes(id) on delete cascade,
  version integer not null check (version > 0),
  doc jsonb not null,
  actor_kind text not null check (actor_kind in ('user', 'agent', 'system')),
  actor_id uuid,
  agent_key text,
  summary text,
  created_at timestamptz not null default now(),
  unique (node_id, version)
);

create index if not exists motion_revisions_node_version_idx on public.motion_revisions (node_id, version desc);

alter table public.motion_revisions enable row level security;

create policy motion_revisions_select on public.motion_revisions
  for select using (org_id in (select auth_org_ids()));

create policy motion_revisions_insert on public.motion_revisions
  for insert with check (
    org_id in (select auth_org_ids())
    and exists (select 1 from public.nodes n where n.id = node_id and n.org_id = motion_revisions.org_id and n.type = 'motion')
  );

grant select, insert on public.motion_revisions to authenticated;

alter table public.chat_threads add column if not exists node_id uuid references public.nodes(id) on delete cascade;

alter table public.chat_threads drop constraint if exists chat_threads_surface_check;
alter table public.chat_threads add constraint chat_threads_surface_check check (surface in ('sidebar', 'mcp', 'cli', 'motion'));

create index if not exists chat_threads_node_idx on public.chat_threads (node_id) where node_id is not null;

commit;
