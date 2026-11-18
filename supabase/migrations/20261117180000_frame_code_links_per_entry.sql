begin;

set local lock_timeout = '5s';
set local statement_timeout = '60s';

alter table public.frame_code_links add column if not exists entry_key text;
update public.frame_code_links
  set entry_key = entry_kind || ':' || coalesce(role, '') || ':' || coalesce(route, '') || ':' || entry
  where entry_key is null;
alter table public.frame_code_links alter column entry_key set not null;
alter table public.frame_code_links add constraint frame_code_links_entry_key_len check (length(entry_key) <= 1200);

alter table public.frame_code_links add column if not exists before_poster text check (length(before_poster) <= 200);

alter table public.frame_code_links drop constraint if exists frame_code_links_pkey;
alter table public.frame_code_links add primary key (node_id, entry_key);

commit;
