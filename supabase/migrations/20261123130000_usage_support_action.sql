begin;

set local lock_timeout = '5s';
set local statement_timeout = '60s';

alter table public.usage_events
  add column if not exists item text;

alter table public.usage_events drop constraint if exists usage_events_item_check;
alter table public.usage_events
  add constraint usage_events_item_check
  check (item is null or item in ('star', 'follow_x', 'discord', 'coffee', 'share'));

alter table public.usage_events drop constraint if exists usage_events_event_check;
alter table public.usage_events
  add constraint usage_events_event_check
  check (event in (
    'install', 'opened', 'session_start', 'preview_ready', 'first_edit', 'edit', 'session_end',
    'sign_in', 'sign_out', 'session_resume',
    'onboarding_started', 'onboarding_step', 'onboarding_finished', 'onboarding_skipped',
    'setup_applied', 'setup_failed', 'skill_hint_shown', 'skill_installed', 'library_insert', 'plugin_installed',
    'support_action'
  ));

commit;
