begin;

set local lock_timeout = '5s';
set local statement_timeout = '60s';

create table if not exists public.project_library (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.orgs(id) on delete cascade,
  project_id  uuid not null references public.projects(id) on delete cascade,
  kind        text not null check (kind in ('style', 'variables')),
  name        text not null check (char_length(name) between 1 and 40),
  value       jsonb not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (project_id, kind, name)
);

create index if not exists project_library_org_idx on public.project_library (org_id);

alter table public.project_library enable row level security;

drop policy if exists "project_library own org" on public.project_library;
create policy "project_library own org" on public.project_library
  for all to authenticated
  using (org_id in (select public.auth_org_ids()))
  with check (org_id in (select public.auth_org_ids()));

commit;
