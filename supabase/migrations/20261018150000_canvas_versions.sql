set lock_timeout = '5s';
set statement_timeout = '60s';

create table if not exists public.canvas_versions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs(id) on delete cascade,
  canvas_id uuid not null references public.canvases(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  snapshot jsonb not null,
  actor_kind text not null check (actor_kind in ('user', 'agent', 'system')),
  actor_id uuid,
  agent_key text,
  created_at timestamptz not null default now()
);

create index if not exists canvas_versions_canvas_idx on public.canvas_versions (canvas_id, created_at desc);

alter table public.canvas_versions enable row level security;

drop policy if exists canvas_versions_select on public.canvas_versions;
create policy canvas_versions_select on public.canvas_versions
  for select to authenticated using (org_id in (select public.auth_org_ids()));

drop policy if exists canvas_versions_insert on public.canvas_versions;
create policy canvas_versions_insert on public.canvas_versions
  for insert to authenticated with check (
    org_id in (select public.auth_org_ids())
    and exists (select 1 from public.canvases c where c.id = canvas_id and c.org_id = canvas_versions.org_id)
  );

drop policy if exists canvas_versions_delete on public.canvas_versions;
create policy canvas_versions_delete on public.canvas_versions
  for delete to authenticated using (org_id in (select public.auth_org_ids()));

drop policy if exists editors_insert on public.canvas_versions;
create policy editors_insert on public.canvas_versions as restrictive for insert to authenticated
  with check (org_id in (select public.auth_editor_org_ids()));

drop policy if exists editors_delete on public.canvas_versions;
create policy editors_delete on public.canvas_versions as restrictive for delete to authenticated
  using (org_id in (select public.auth_editor_org_ids()));

grant select, insert, delete on public.canvas_versions to authenticated;
