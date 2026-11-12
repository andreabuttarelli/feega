begin;

set local lock_timeout = '5s';
set local statement_timeout = '60s';

create table if not exists public.canvas_debug_logs (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  session text not null,
  seq integer not null,
  t_ms double precision not null,
  user_id uuid references auth.users(id) on delete set null,
  org_id uuid references public.orgs(id) on delete set null,
  canvas_id uuid references public.canvases(id) on delete set null,
  kind text not null,
  props jsonb not null default '{}'::jsonb
);

create index if not exists canvas_debug_logs_session_seq_idx on public.canvas_debug_logs (session, seq);
create index if not exists canvas_debug_logs_created_idx on public.canvas_debug_logs (created_at);

alter table public.canvas_debug_logs enable row level security;

revoke all on public.canvas_debug_logs from anon, authenticated;

comment on table public.canvas_debug_logs is 'Flight recorder of a canvas opened with ?debug. Rows older than 14 days can be deleted: delete from public.canvas_debug_logs where created_at < now() - interval ''14 days''.';

create or replace view public.canvas_debug_sessions with (security_invoker = true) as
select session,
       min(user_id::text) as user_id,
       min(canvas_id::text) as canvas_id,
       min(created_at) as first_at,
       max(created_at) as last_at,
       count(*) as lines,
       max(seq) as last_seq,
       max(seq) + 1 - count(*) as lost_lines,
       bool_or(kind = 'pagehide') as ended_cleanly,
       max(props->>'device') filter (where kind = 'start') as device,
       max(props->>'backend') filter (where kind = 'backend') as backend,
       max(props->'previous'->>'session') filter (where kind = 'start') as previous_session,
       bool_or((props->'previous'->>'clean') = 'false') filter (where kind = 'start') as previous_crashed
from public.canvas_debug_logs
group by session;

revoke all on public.canvas_debug_sessions from anon, authenticated;

commit;
