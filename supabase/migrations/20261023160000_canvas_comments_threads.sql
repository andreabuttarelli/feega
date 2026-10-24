set lock_timeout = '5s';
set statement_timeout = '60s';

alter table public.canvas_comments
  add column if not exists time_ms integer check (time_ms is null or time_ms >= 0),
  add column if not exists edited_at timestamptz,
  add column if not exists mentions uuid[] not null default '{}';
