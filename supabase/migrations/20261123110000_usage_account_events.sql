begin;

set local lock_timeout = '5s';
set local statement_timeout = '60s';

alter table public.usage_events drop constraint if exists usage_events_event_check;
alter table public.usage_events
  add constraint usage_events_event_check
  check (event in ('install', 'opened', 'session_start', 'preview_ready', 'first_edit', 'edit', 'session_end', 'sign_in', 'sign_out', 'session_resume'));

drop function if exists public.admin_usage_funnel();
create function public.admin_usage_funnel()
returns table (installed bigint, opened bigint, started bigint, preview_ready bigint, first_edit bigint, signed_in bigint, multi_day bigint)
language sql stable
as $$
  with e as (
    select install_id, event, created_at
    from public.usage_events
    where created_at >= now() - interval '30 days' and ext_version ~ '^\d+\.\d+\.\d+'
  ),
  i as (select distinct install_id from e where event = 'install'),
  o as (select distinct install_id from e where event = 'opened'),
  s as (select distinct install_id from e where event = 'session_start'),
  p as (select distinct install_id from e where event = 'preview_ready' and install_id in (select install_id from s)),
  f as (select distinct install_id from e where event = 'first_edit' and install_id in (select install_id from p)),
  g as (select distinct install_id from e where event = 'sign_in' and install_id in (select install_id from f)),
  d as (
    select install_id from e
    where event = 'edit' and install_id in (select install_id from f)
    group by install_id
    having count(distinct created_at::date) >= 2
  )
  select (select count(*) from i), (select count(*) from o), (select count(*) from s), (select count(*) from p), (select count(*) from f), (select count(*) from g), (select count(*) from d)
$$;

create or replace function public.admin_signups_weekly()
returns table (week date, total bigint, confirmed bigint)
language sql stable
as $$
  select date_trunc('week', u.created_at)::date,
    count(*),
    count(*) filter (where u.email_confirmed_at is not null)
  from auth.users u
  where u.created_at >= date_trunc('week', now()) - interval '11 weeks'
    and split_part(lower(u.email), '@', 2) not in (select domain from public.blocked_email_domains)
  group by 1
  order by 1
$$;

revoke all on function public.admin_usage_funnel(), public.admin_signups_weekly() from public, anon, authenticated;
grant execute on function public.admin_usage_funnel(), public.admin_signups_weekly() to service_role;

commit;
