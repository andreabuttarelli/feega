create table if not exists public.effects (
  id             uuid primary key default gen_random_uuid(),
  org_id         uuid not null references public.orgs(id) on delete cascade,
  name           text not null check (name ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and length(name) <= 48),
  version        integer not null default 1,
  frag           text not null check (length(frag) <= 12288),
  params         jsonb not null default '[]'::jsonb,
  check_state    text not null default 'unchecked' check (check_state in ('unchecked', 'passed', 'failed')),
  check_problems jsonb not null default '[]'::jsonb,
  cost_ms        real,
  actor_kind     text not null check (actor_kind in ('user', 'agent', 'system')),
  actor_id       uuid not null references public.profiles(id) on delete cascade,
  agent_key      text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  deleted_at     timestamptz
);

create unique index if not exists effects_org_name_live on public.effects (org_id, name) where deleted_at is null;

alter table public.effects enable row level security;

drop policy if exists "effects own org" on public.effects;
create policy "effects own org" on public.effects
  for all to authenticated
  using (org_id in (select public.auth_org_ids()))
  with check (org_id in (select public.auth_org_ids()));
