begin;

set local lock_timeout = '5s';
set local statement_timeout = '60s';

alter table public.usage_events
  add column if not exists framework text,
  add column if not exists edit_kind text,
  add column if not exists signed_in boolean;

alter table public.usage_events drop constraint if exists usage_events_event_check;
alter table public.usage_events
  add constraint usage_events_event_check
  check (event in ('session_start', 'preview_ready', 'first_edit', 'edit', 'session_end'));

create or replace function public.admin_usage_weekly_active()
returns table (week date, editor text, installs bigint)
language sql stable
as $$
  select date_trunc('week', created_at)::date, editor, count(distinct install_id)
  from public.usage_events
  where event = 'edit'
    and ext_version ~ '^\d+\.\d+\.\d+'
    and created_at >= date_trunc('week', now()) - interval '11 weeks'
  group by 1, 2
  order by 1, 2
$$;

create or replace function public.admin_usage_retention()
returns table (cohort date, installs bigint, w1 bigint, w2 bigint, w4 bigint, w8 bigint)
language sql stable
as $$
  with edits as (
    select install_id, date_trunc('week', created_at)::date as w
    from public.usage_events
    where event = 'edit' and ext_version ~ '^\d+\.\d+\.\d+'
    group by 1, 2
  ),
  cohorts as (
    select install_id, min(w) as c from edits group by 1
  )
  select c.c,
    count(distinct c.install_id),
    count(distinct e.install_id) filter (where e.w = c.c + 7),
    count(distinct e.install_id) filter (where e.w = c.c + 14),
    count(distinct e.install_id) filter (where e.w = c.c + 28),
    count(distinct e.install_id) filter (where e.w = c.c + 56)
  from cohorts c
  join edits e using (install_id)
  group by c.c
  order by c.c desc
  limit 12
$$;

create or replace function public.admin_usage_funnel()
returns table (started bigint, preview_ready bigint, first_edit bigint, multi_day bigint)
language sql stable
as $$
  with e as (
    select install_id, event, created_at
    from public.usage_events
    where created_at >= now() - interval '30 days' and ext_version ~ '^\d+\.\d+\.\d+'
  ),
  s as (select distinct install_id from e where event = 'session_start'),
  p as (select distinct install_id from e where event = 'preview_ready' and install_id in (select install_id from s)),
  f as (select distinct install_id from e where event = 'first_edit' and install_id in (select install_id from p)),
  d as (
    select install_id from e
    where event = 'edit' and install_id in (select install_id from f)
    group by install_id
    having count(distinct created_at::date) >= 2
  )
  select (select count(*) from s), (select count(*) from p), (select count(*) from f), (select count(*) from d)
$$;

revoke all on function public.admin_usage_weekly_active(), public.admin_usage_retention(), public.admin_usage_funnel() from public, anon, authenticated;
grant execute on function public.admin_usage_weekly_active(), public.admin_usage_retention(), public.admin_usage_funnel() to service_role;

commit;
