begin;

set local lock_timeout = '5s';
set local statement_timeout = '60s';

alter table public.frame_code_links add column if not exists variant_of uuid references public.nodes(id) on delete set null;
create index if not exists frame_code_links_variant_of_idx on public.frame_code_links (variant_of);

commit;
