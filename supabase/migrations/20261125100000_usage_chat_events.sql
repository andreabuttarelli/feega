begin;

set local lock_timeout = '5s';
set local statement_timeout = '60s';

insert into public.usage_event_kinds (event) values
  ('editor_opened'), ('ai_chat_created'), ('ai_config_changed')
on conflict (event) do nothing;

alter table public.usage_events
  add column if not exists category text,
  add column if not exists chat_count integer check (chat_count >= 0),
  add column if not exists live_count integer check (live_count >= 0);

commit;
