begin;

set local lock_timeout = '5s';
set local statement_timeout = '60s';

insert into storage.buckets (id, name, public)
values ('library-pro', 'library-pro', false)
on conflict (id) do nothing;

commit;
