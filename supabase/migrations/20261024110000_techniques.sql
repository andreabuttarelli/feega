begin;

set local lock_timeout = '5s';
set local statement_timeout = '60s';

create table if not exists public.techniques (
  id         uuid primary key default gen_random_uuid(),
  org_id     uuid not null references public.orgs(id) on delete cascade,
  name       text not null check (name ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and length(name) <= 48),
  version    integer not null default 1,
  plan       jsonb not null,
  inputs     jsonb not null default '[]'::jsonb,
  outputs    jsonb not null default '[]'::jsonb,
  actor_kind text not null check (actor_kind in ('user', 'agent', 'system')),
  actor_id   uuid not null references public.profiles(id) on delete cascade,
  agent_key  text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create unique index if not exists techniques_org_name_live on public.techniques (org_id, name) where deleted_at is null;
create index if not exists techniques_actor_id_idx on public.techniques (actor_id);

alter table public.techniques enable row level security;

drop policy if exists "techniques own org" on public.techniques;
create policy "techniques own org" on public.techniques
  for all to authenticated
  using (org_id in (select public.auth_org_ids()))
  with check (org_id in (select public.auth_org_ids()));

commit;
