begin;

set local lock_timeout = '5s';
set local statement_timeout = '60s';

alter table public.chat_messages
  add column if not exists selection jsonb
  check (selection is null or jsonb_typeof(selection) = 'array');

commit;
