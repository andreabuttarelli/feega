begin;

set local lock_timeout = '5s';
set local statement_timeout = '60s';

alter table public.product_events drop constraint if exists product_events_event_check;

alter table public.product_events add constraint product_events_event_check check (event in (
  'landing_prompt_sent', 'login_started', 'signup_completed', 'handoff_resumed', 'canvas_created',
  'agent_started', 'agent_first_output', 'agent_failed', 'credits_exhausted', 'import_failed',
  'upgrade_offer_shown', 'upgrade_offer_clicked', 'upgrade_offer_redeemed'
));

commit;
