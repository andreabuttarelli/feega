set lock_timeout = '5s';
set statement_timeout = '60s';

create table if not exists public.org_spend_caps (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs(id) on delete cascade,
  scope text not null check (scope in ('org_member', 'project_member', 'project_total')),
  project_id uuid references public.projects(id) on delete cascade,
  cap_usd numeric(12, 2) not null check (cap_usd > 0),
  reset text not null default 'none' check (reset in ('none', 'monthly')),
  created_at timestamptz not null default now(),
  constraint org_spend_caps_scope_project check ((scope = 'org_member') = (project_id is null))
);

create unique index if not exists org_spend_caps_scope_key
  on public.org_spend_caps (org_id, scope, coalesce(project_id, '00000000-0000-0000-0000-000000000000'::uuid));

alter table public.org_spend_caps enable row level security;

create policy org_spend_caps_read on public.org_spend_caps
  for select to authenticated
  using (org_id in (select public.auth_org_ids()));

create policy org_spend_caps_admin_write on public.org_spend_caps
  for all to authenticated
  using (org_id in (select public.auth_admin_org_ids()))
  with check (org_id in (select public.auth_admin_org_ids()));
