begin;

set local lock_timeout = '5s';
set local statement_timeout = '60s';

create table if not exists public.usage_event_kinds (
  event text primary key
);

alter table public.usage_event_kinds enable row level security;
revoke all on public.usage_event_kinds from anon, authenticated;

insert into public.usage_event_kinds (event) values
  ('install'), ('opened'), ('session_start'), ('preview_ready'), ('first_edit'), ('edit'), ('session_end'),
  ('sign_in'), ('sign_out'), ('session_resume'),
  ('onboarding_started'), ('onboarding_step'), ('onboarding_finished'), ('onboarding_skipped'),
  ('setup_applied'), ('setup_failed'), ('skill_hint_shown'), ('skill_installed'), ('library_insert'),
  ('plugin_installed'), ('support_action'),
  ('project_detected'), ('editor_opened'), ('element_selected'), ('edit_reverted'),
  ('breakpoint_switch'), ('state_switch'), ('copy_for_agent'), ('focus_opened'),
  ('ai_agent_chosen'), ('ai_session_started'), ('ai_message_sent'), ('ai_first_response'),
  ('ai_tool_call'), ('ai_permission'), ('ai_cancel'), ('ai_session_error'), ('ai_session_ended'),
  ('sign_in_prompted'), ('share_action'), ('cloud_action'), ('mcp_tool_call'),
  ('error_host'), ('error_webview')
on conflict (event) do nothing;

alter table public.usage_events drop constraint if exists usage_events_event_check;
alter table public.usage_events drop constraint if exists usage_events_event_fkey;
alter table public.usage_events
  add constraint usage_events_event_fkey foreign key (event) references public.usage_event_kinds (event);

alter table public.usage_events drop constraint if exists usage_events_editor_check;
alter table public.usage_events
  add constraint usage_events_editor_check
  check (editor in ('vscode', 'cursor', 'windsurf', 'vscodium', 'other', 'npx'));

alter table public.usage_events
  add column if not exists styling text,
  add column if not exists impact text,
  add column if not exists target text,
  add column if not exists prop_category text,
  add column if not exists file_ext text,
  add column if not exists breakpoint text,
  add column if not exists state text,
  add column if not exists source text,
  add column if not exists outcome text,
  add column if not exists choice text,
  add column if not exists area text,
  add column if not exists variant text,
  add column if not exists agent text,
  add column if not exists library_item text,
  add column if not exists tool text,
  add column if not exists error_class text,
  add column if not exists action text,
  add column if not exists lines_added integer check (lines_added >= 0),
  add column if not exists lines_removed integer check (lines_removed >= 0),
  add column if not exists files_count integer check (files_count >= 0),
  add column if not exists diff_count integer check (diff_count >= 0),
  add column if not exists message_count integer check (message_count >= 0),
  add column if not exists tool_count integer check (tool_count >= 0);

create index if not exists usage_events_event_created_idx on public.usage_events (event, created_at);

create or replace function public.admin_usage_weekly_active()
returns table (week date, editor text, installs bigint)
language sql stable
as $$
  select date_trunc('week', created_at)::date, editor, count(distinct install_id)
  from public.usage_events
  where ext_version ~ '^\d+\.\d+\.\d+'
    and created_at >= date_trunc('week', now()) - interval '11 weeks'
  group by 1, 2
  order by 1, 2
$$;

create or replace function public.admin_usage_retention()
returns table (cohort date, installs bigint, w1 bigint, w2 bigint, w4 bigint, w8 bigint)
language sql stable
as $$
  with active as (
    select install_id, date_trunc('week', created_at)::date as w
    from public.usage_events
    where ext_version ~ '^\d+\.\d+\.\d+'
    group by 1, 2
  ),
  cohorts as (
    select install_id, min(w) as c from active group by 1
  )
  select c.c,
    count(distinct c.install_id),
    count(distinct a.install_id) filter (where a.w = c.c + 7),
    count(distinct a.install_id) filter (where a.w = c.c + 14),
    count(distinct a.install_id) filter (where a.w = c.c + 28),
    count(distinct a.install_id) filter (where a.w = c.c + 56)
  from cohorts c
  join active a using (install_id)
  group by c.c
  order by c.c desc
  limit 12
$$;

create or replace function public.admin_usage_active(grain text)
returns table (period date, installs bigint, signed_in bigint, anonymous bigint)
language sql stable
as $$
  select date_trunc(grain, created_at)::date,
    count(distinct install_id),
    count(distinct install_id) filter (where signed_in is true),
    count(distinct install_id) - count(distinct install_id) filter (where signed_in is true)
  from public.usage_events
  where grain in ('day', 'week')
    and ext_version ~ '^\d+\.\d+\.\d+'
    and created_at >= case when grain = 'day' then now() - interval '30 days' else date_trunc('week', now()) - interval '11 weeks' end
  group by 1
  order by 1 desc
$$;

create or replace function public.admin_usage_funnel_steps()
returns table (step text, installs bigint)
language sql stable
as $$
  with e as (
    select install_id, event, signed_in, created_at
    from public.usage_events
    where ext_version ~ '^\d+\.\d+\.\d+'
  ),
  cohort as (
    select install_id, min(created_at) as first_at
    from e
    group by install_id
    having min(created_at) >= now() - interval '30 days'
  ),
  reached as (
    select 1 as ord, 'first_seen' as step, c.install_id from cohort c
    union all
    select 2, 'project_detected', c.install_id from cohort c join e using (install_id) where e.event in ('project_detected', 'preview_ready')
    union all
    select 3, 'first_edit', c.install_id from cohort c join e using (install_id) where e.event in ('first_edit', 'edit')
    union all
    select 4, 'signed_in', c.install_id from cohort c join e using (install_id) where e.event = 'sign_in' or e.signed_in is true
    union all
    select 5, 'returned_7d', c.install_id from cohort c join e using (install_id) where e.created_at >= c.first_at + interval '7 days'
  )
  select step, count(distinct install_id) from reached group by ord, step order by ord
$$;

create or replace function public.admin_usage_onboarding()
returns table (step text, viewed bigint, completed bigint, skipped bigint)
language sql stable
as $$
  with window_events as (
    select * from public.usage_events
    where ext_version ~ '^\d+\.\d+\.\d+' and created_at >= now() - interval '30 days'
  )
  select s.step,
    count(distinct s.install_id) filter (where coalesce(s.outcome, 'viewed') = 'viewed'),
    count(distinct s.install_id) filter (where s.outcome = 'completed'),
    count(distinct s.install_id) filter (where s.outcome = 'skipped')
  from window_events s
  where s.event = 'onboarding_step' and s.step is not null
  group by s.step
  union all
  select 'connect_agents:' || s.choice, 0, count(distinct s.install_id), 0
  from window_events s
  where s.event = 'onboarding_step' and s.step = 'connect_agents' and s.choice is not null
  group by s.choice
  union all
  select 'sign_in_prompt',
    (select count(distinct install_id) from window_events where event = 'sign_in_prompted'),
    (select count(distinct install_id) from window_events where event = 'sign_in'),
    0
$$;

create or replace function public.admin_usage_features()
returns table (event text, events bigint, installs bigint)
language sql stable
as $$
  select event, count(*), count(distinct install_id)
  from public.usage_events
  where created_at >= now() - interval '30 days'
    and ext_version ~ '^\d+\.\d+\.\d+'
    and event not in ('session_start', 'session_end', 'session_resume')
  group by event
  order by 2 desc
$$;

create or replace function public.admin_usage_agents()
returns table (agent text, sessions bigint, messages bigint, tool_calls bigint, allowed bigint, rejected bigint, cancels bigint, errors bigint, diffs bigint, reverted bigint)
language sql stable
as $$
  select agent,
    count(*) filter (where event = 'ai_session_started'),
    count(*) filter (where event = 'ai_message_sent'),
    count(*) filter (where event = 'ai_tool_call'),
    count(*) filter (where event = 'ai_permission' and outcome = 'allow'),
    count(*) filter (where event = 'ai_permission' and outcome = 'reject'),
    count(*) filter (where event = 'ai_cancel'),
    count(*) filter (where event = 'ai_session_error'),
    count(*) filter (where event = 'edit' and source = 'ai'),
    count(*) filter (where event = 'edit_reverted' and source = 'ai')
  from public.usage_events
  where agent is not null and created_at >= now() - interval '30 days'
  group by agent
  order by 2 desc
$$;

create or replace function public.admin_usage_errors()
returns table (event text, error_class text, area text, events bigint, installs bigint)
language sql stable
as $$
  select event, coalesce(error_class, 'unknown'), coalesce(area, 'other'), count(*), count(distinct install_id)
  from public.usage_events
  where event in ('error_host', 'error_webview', 'ai_session_error', 'setup_failed')
    and created_at >= now() - interval '30 days'
  group by 1, 2, 3
  order by 4 desc
$$;

create or replace function public.admin_usage_frameworks()
returns table (framework text, styling text, installs bigint)
language sql stable
as $$
  select framework, coalesce(styling, 'unknown'), count(distinct install_id)
  from public.usage_events
  where framework is not null and created_at >= now() - interval '30 days'
  group by 1, 2
  order by 3 desc
$$;

create or replace function public.admin_usage_surfaces()
returns table (editor text, os text, ext_version text, installs bigint)
language sql stable
as $$
  select editor, os, ext_version, count(distinct install_id)
  from public.usage_events
  where created_at >= now() - interval '30 days' and ext_version ~ '^\d+\.\d+\.\d+'
  group by 1, 2, 3
  order by 4 desc
$$;

create or replace function public.admin_usage_diffs()
returns table (day date, diffs bigint, manual bigint, ai bigint, reverted bigint, lines_added bigint, lines_removed bigint)
language sql stable
as $$
  select created_at::date,
    count(*) filter (where event = 'edit' and coalesce(source, 'manual') <> 'revert'),
    count(*) filter (where event = 'edit' and coalesce(source, 'manual') = 'manual'),
    count(*) filter (where event = 'edit' and source = 'ai'),
    count(*) filter (where event = 'edit_reverted'),
    coalesce(sum(lines_added) filter (where event = 'edit'), 0),
    coalesce(sum(lines_removed) filter (where event = 'edit'), 0)
  from public.usage_events
  where event in ('edit', 'edit_reverted') and created_at >= now() - interval '30 days'
  group by 1
  order by 1 desc
$$;

create or replace function public.admin_usage_edit_dims()
returns table (dim text, value text, diffs bigint)
language sql stable
as $$
  with edits as (
    select * from public.usage_events
    where event = 'edit' and coalesce(source, 'manual') <> 'revert' and created_at >= now() - interval '30 days'
  )
  select 'prop_category', prop_category, count(*) from edits where prop_category is not null group by 2
  union all select 'target', target, count(*) from edits where target is not null group by 2
  union all select 'file_ext', file_ext, count(*) from edits where file_ext is not null group by 2
  union all select 'breakpoint', breakpoint, count(*) from edits where breakpoint is not null group by 2
  union all select 'state', state, count(*) from edits where state is not null group by 2
$$;

drop function if exists public.admin_signups_weekly();
create function public.admin_signups_weekly()
returns table (week date, total bigint, confirmed bigint, blocked bigint)
language sql stable
security definer
set search_path to ''
as $$
  with users as (
    select u.created_at, u.email_confirmed_at,
      exists (select 1 from public.blocked_email_domains b where b.domain = split_part(lower(coalesce(u.email, '')), '@', 2)) as is_blocked
    from auth.users u
    where u.created_at >= date_trunc('week', now()) - interval '11 weeks'
  )
  select date_trunc('week', created_at)::date,
    count(*) filter (where not is_blocked),
    count(*) filter (where not is_blocked and email_confirmed_at is not null),
    count(*) filter (where is_blocked)
  from users
  group by 1
  order by 1
$$;

drop function if exists public.admin_usage_funnel();

revoke all on function
  public.admin_usage_weekly_active(), public.admin_usage_retention(), public.admin_usage_active(text),
  public.admin_usage_funnel_steps(), public.admin_usage_onboarding(), public.admin_usage_features(),
  public.admin_usage_agents(), public.admin_usage_errors(), public.admin_usage_frameworks(),
  public.admin_usage_surfaces(), public.admin_usage_diffs(), public.admin_usage_edit_dims(),
  public.admin_signups_weekly()
from public, anon, authenticated;
grant execute on function
  public.admin_usage_weekly_active(), public.admin_usage_retention(), public.admin_usage_active(text),
  public.admin_usage_funnel_steps(), public.admin_usage_onboarding(), public.admin_usage_features(),
  public.admin_usage_agents(), public.admin_usage_errors(), public.admin_usage_frameworks(),
  public.admin_usage_surfaces(), public.admin_usage_diffs(), public.admin_usage_edit_dims(),
  public.admin_signups_weekly()
to service_role;

commit;
