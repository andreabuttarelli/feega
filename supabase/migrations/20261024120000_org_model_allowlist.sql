set lock_timeout = '5s';
set statement_timeout = '60s';

create table if not exists public.org_model_allowlist (
  org_id uuid not null references public.orgs(id) on delete cascade,
  medium text not null check (medium in ('image', 'video', 'model3d')),
  model_id text not null,
  created_at timestamptz not null default now(),
  primary key (org_id, medium, model_id)
);

alter table public.org_model_allowlist enable row level security;

create policy org_model_allowlist_read on public.org_model_allowlist
  for select to authenticated
  using (org_id in (select public.auth_org_ids()));

create policy org_model_allowlist_admin_write on public.org_model_allowlist
  for all to authenticated
  using (org_id in (select public.auth_admin_org_ids()))
  with check (org_id in (select public.auth_admin_org_ids()));
