set lock_timeout = '3s';
set statement_timeout = '30s';

create table if not exists public.user_cloud_tokens (
  user_id       uuid not null references public.profiles(id) on delete cascade,
  provider      text not null check (provider in ('google_drive', 'dropbox')),
  tokens_sealed text not null check (length(tokens_sealed) <= 4000),
  account_label text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  primary key (user_id, provider)
);

alter table public.user_cloud_tokens enable row level security;

drop policy if exists "user_cloud_tokens own" on public.user_cloud_tokens;
create policy "user_cloud_tokens own" on public.user_cloud_tokens
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
