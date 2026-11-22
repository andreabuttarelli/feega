begin;

set local lock_timeout = '5s';
set local statement_timeout = '60s';

alter table public.frame_code_links add column if not exists work_branch text check (length(work_branch) <= 200);

commit;
