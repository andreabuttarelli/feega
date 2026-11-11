begin;

set local lock_timeout = '5s';
set local statement_timeout = '60s';

create table if not exists public.product_events (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references public.orgs(id) on delete set null,
  user_id uuid references auth.users(id) on delete set null,
  anonymous_id text,
  event text not null check (event in (
    'landing_prompt_sent', 'login_started', 'signup_completed', 'handoff_resumed', 'canvas_created',
    'agent_started', 'agent_first_output', 'agent_failed', 'credits_exhausted', 'import_failed'
  )),
  props jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists product_events_event_created_idx on public.product_events (event, created_at);

alter table public.product_events enable row level security;

revoke all on public.product_events from anon, authenticated;

create or replace view public.product_funnel_daily with (security_invoker = true) as
select date_trunc('day', created_at)::date as day,
       event,
       count(*) as events,
       count(distinct coalesce(user_id::text, anonymous_id)) as people
from public.product_events
group by 1, 2;

revoke all on public.product_funnel_daily from anon, authenticated;

create unique index if not exists credit_ledger_signup_grant_once
  on public.credit_ledger (created_by)
  where note = 'signup_grant';

commit;
