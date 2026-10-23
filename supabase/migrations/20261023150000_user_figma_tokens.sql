set lock_timeout = '3s';
set statement_timeout = '30s';

create table if not exists public.user_figma_tokens (
  user_id      uuid primary key references public.profiles(id) on delete cascade,
  token_sealed text not null check (length(token_sealed) <= 2000),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

alter table public.user_figma_tokens enable row level security;

drop policy if exists "user_figma_tokens own" on public.user_figma_tokens;
create policy "user_figma_tokens own" on public.user_figma_tokens
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
