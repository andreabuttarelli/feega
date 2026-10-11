create table if not exists public.app_accounts (
  project_id     uuid primary key references public.projects(id) on delete cascade,
  org_id         uuid not null references public.orgs(id) on delete cascade,
  login_url      text not null check (length(login_url) <= 2000),
  email          text not null check (length(email) <= 320),
  test_password  text not null check (length(test_password) <= 200),
  session        jsonb not null default '{"cookies": [], "storage": {}}'::jsonb,
  session_until  timestamptz,
  actor_kind     text not null check (actor_kind in ('user', 'agent', 'system')),
  actor_id       uuid not null references public.profiles(id) on delete cascade,
  agent_key      text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index if not exists app_accounts_org on public.app_accounts (org_id);

comment on column public.app_accounts.test_password is 'a TEST account password the user gave in chat, visible to the AI by design';

alter table public.app_accounts enable row level security;

drop policy if exists "app_accounts own org" on public.app_accounts;
create policy "app_accounts own org" on public.app_accounts
  for all to authenticated
  using (org_id in (select public.auth_org_ids()))
  with check (org_id in (select public.auth_org_ids()));
