begin;

create table if not exists public.motion_templates (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  description text not null default '' check (char_length(description) <= 200),
  doc jsonb not null,
  poster_frame integer not null default 0 check (poster_frame >= 0),
  actor_kind text not null check (actor_kind in ('user', 'agent', 'system')),
  actor_id uuid,
  agent_key text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists motion_templates_org_idx on public.motion_templates (org_id, created_at desc);

alter table public.motion_templates enable row level security;

create policy motion_templates_select on public.motion_templates
  for select using (org_id in (select auth_org_ids()));

create policy motion_templates_insert on public.motion_templates
  for insert with check (org_id in (select auth_org_ids()));

create policy motion_templates_update on public.motion_templates
  for update using (org_id in (select auth_org_ids())) with check (org_id in (select auth_org_ids()));

create policy motion_templates_delete on public.motion_templates
  for delete using (org_id in (select auth_org_ids()));

grant select, insert, update, delete on public.motion_templates to authenticated;

commit;
