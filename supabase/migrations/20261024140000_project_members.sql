set lock_timeout = '5s';
set statement_timeout = '60s';

create table if not exists public.project_members (
  project_id uuid not null references public.projects(id) on delete cascade,
  org_id uuid not null references public.orgs(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('admin', 'edit', 'view')),
  guest boolean not null default false,
  created_at timestamptz not null default now(),
  primary key (project_id, user_id)
);

create index if not exists project_members_user_idx on public.project_members (user_id);
create index if not exists project_members_org_idx on public.project_members (org_id);

alter table public.project_members enable row level security;

create or replace function public.auth_project_ids() returns setof uuid
  language sql stable security definer set search_path = public as $$
  select project_id from public.project_members where user_id = auth.uid()
$$;

revoke execute on function public.auth_project_ids() from public, anon;
grant execute on function public.auth_project_ids() to authenticated;

create policy project_members_read on public.project_members
  for select to authenticated
  using (org_id in (select public.auth_org_ids()) or user_id = auth.uid());

create policy project_members_admin_write on public.project_members
  for all to authenticated
  using (org_id in (select public.auth_admin_org_ids()))
  with check (org_id in (select public.auth_admin_org_ids()));

alter table public.canvases
  add column if not exists share_role text not null default 'view' check (share_role in ('view', 'edit'));
