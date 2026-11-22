begin;

set local lock_timeout = '5s';
set local statement_timeout = '60s';

create table if not exists public.usage_events (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  install_id uuid not null,
  session_id uuid not null,
  event text not null check (event in ('session_start', 'edit', 'session_end')),
  ext_version text not null,
  editor text not null check (editor in ('vscode', 'cursor', 'windsurf', 'vscodium', 'npx')),
  os text not null,
  arch text not null,
  device text not null check (device in ('desktop', 'web', 'cli')),
  edit_count integer check (edit_count >= 0),
  duration_ms bigint check (duration_ms >= 0),
  country text,
  region text,
  city text
);

create index if not exists usage_events_created_idx on public.usage_events (created_at);
create index if not exists usage_events_session_idx on public.usage_events (session_id);

alter table public.usage_events enable row level security;

revoke all on public.usage_events from anon, authenticated;

commit;
