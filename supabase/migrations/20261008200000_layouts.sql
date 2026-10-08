create table if not exists public.layouts (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.orgs(id) on delete cascade,
  name        text not null check (name ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and length(name) <= 48),
  version     integer not null default 1,
  kind        text not null default 'spec' check (kind in ('spec')),
  spec        jsonb not null,
  actor_kind  text not null check (actor_kind in ('user', 'agent', 'system')),
  actor_id    uuid not null references public.profiles(id) on delete cascade,
  agent_key   text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz
);

create unique index if not exists layouts_org_name_live on public.layouts (org_id, name) where deleted_at is null;

alter table public.layouts enable row level security;

drop policy if exists "layouts own org" on public.layouts;
create policy "layouts own org" on public.layouts
  for all to authenticated
  using (org_id in (select public.auth_org_ids()))
  with check (org_id in (select public.auth_org_ids()));
