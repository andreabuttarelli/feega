begin;

set local lock_timeout = '5s';
set local statement_timeout = '60s';

insert into public.usage_event_kinds (event) values
  ('focus_props_changed'), ('focus_variants_shown')
on conflict (event) do nothing;

alter table public.usage_events
  add column if not exists mode text,
  add column if not exists control text,
  add column if not exists library_category text,
  add column if not exists prop_count integer check (prop_count >= 0);

commit;
