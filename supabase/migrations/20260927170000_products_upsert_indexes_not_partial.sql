-- 20260927130000 used `create unique index if not exists` with the same names as the partial
-- indexes already on production, so it was a no-op there. Replace them with plain indexes that
-- PostgREST's `ON CONFLICT (columns)` can target.
begin;

drop index if exists public.products_node_external_idx;
create unique index products_node_external_idx
  on public.products (node_id, platform, external_id);

drop index if exists public.products_brand_external_idx;
create unique index products_brand_external_idx
  on public.products (brand_id, platform, external_id);

commit;
