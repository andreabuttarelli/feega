set lock_timeout = '3s';
set statement_timeout = '30s';

create table if not exists public.user_connected_accounts (
  org_id               uuid not null references public.orgs(id) on delete cascade,
  user_id              uuid not null references public.profiles(id) on delete cascade,
  toolkit              text not null check (toolkit in ('github')),
  connected_account_id text not null check (length(connected_account_id) <= 200),
  status               text not null default 'pending' check (status in ('pending', 'active', 'gone')),
  account_label        text check (length(account_label) <= 200),
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  primary key (org_id, user_id, toolkit)
);

alter table public.user_connected_accounts enable row level security;

drop policy if exists "user_connected_accounts own" on public.user_connected_accounts;
create policy "user_connected_accounts own" on public.user_connected_accounts
  for all to authenticated
  using (user_id = auth.uid() and org_id in (select public.auth_org_ids()))
  with check (user_id = auth.uid() and org_id in (select public.auth_org_ids()));
