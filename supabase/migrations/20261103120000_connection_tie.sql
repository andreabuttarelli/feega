begin;

set local lock_timeout = '5s';
set local statement_timeout = '60s';

alter table public.nodes_connections
  add column if not exists tie jsonb
  check (tie is null or (jsonb_typeof(tie->'id') = 'string' and jsonb_typeof(tie->'x') = 'number' and jsonb_typeof(tie->'y') = 'number'));

commit;
