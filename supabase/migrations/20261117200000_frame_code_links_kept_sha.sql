begin;

set local lock_timeout = '5s';
set local statement_timeout = '60s';

alter table public.frame_code_links add column if not exists kept_sha text check (length(kept_sha) <= 64);

commit;
