begin;

set local lock_timeout = '5s';
set local statement_timeout = '60s';

create table if not exists public.user_emails (
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null,
  ref_id text not null,
  sent_at timestamptz not null default now(),
  unique (user_id, kind, ref_id)
);

alter table public.user_emails enable row level security;

revoke all on public.user_emails from anon, authenticated;

commit;
