begin;

set local lock_timeout = '5s';
set local statement_timeout = '60s';

alter table public.usage_events
  add column if not exists step text,
  add column if not exists tier text;

alter table public.usage_events drop constraint if exists usage_events_event_check;
alter table public.usage_events
  add constraint usage_events_event_check
  check (event in (
    'install', 'opened', 'session_start', 'preview_ready', 'first_edit', 'edit', 'session_end',
    'sign_in', 'sign_out', 'session_resume',
    'onboarding_started', 'onboarding_step', 'onboarding_finished', 'onboarding_skipped',
    'setup_applied', 'setup_failed', 'skill_hint_shown', 'skill_installed', 'library_insert', 'plugin_installed'
  ));

drop function if exists public.admin_usage_funnel();
create function public.admin_usage_funnel()
returns table (installed bigint, opened bigint, onboarded bigint, started bigint, preview_ready bigint, first_edit bigint, signed_in bigint, multi_day bigint)
language sql stable
as $$
  with e as (
    select install_id, event, created_at
    from public.usage_events
    where created_at >= now() - interval '30 days' and ext_version ~ '^\d+\.\d+\.\d+'
  ),
  i as (select distinct install_id from e where event = 'install'),
  o as (select distinct install_id from e where event = 'opened'),
  b as (select distinct install_id from e where event = 'onboarding_finished'),
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
  select (select count(*) from i), (select count(*) from o), (select count(*) from b), (select count(*) from s), (select count(*) from p), (select count(*) from f), (select count(*) from g), (select count(*) from d)
$$;

revoke all on function public.admin_usage_funnel() from public, anon, authenticated;
grant execute on function public.admin_usage_funnel() to service_role;

commit;
