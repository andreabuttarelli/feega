-- `repos/products.ts::upsertNodeProducts` has upserted onConflict 'node_id,platform,external_id'
-- since the `products` canvas node shipped, but no migration ever created a matching unique
-- index — `products.node_id`/`products.project_id` were applied by hand, this index was not.
-- Every sync of a `products` node fails with 42P10 ("no unique or exclusion constraint matching
-- the ON CONFLICT specification") — confirmed live against klnswzhhgrqvbfjzioul. Same story for
-- `insertBrandProducts`'s onConflict 'brand_id,platform,external_id': that index was missing too.
--
-- NOT PARTIAL, ON PURPOSE: PostgREST's upsert always emits a plain `ON CONFLICT (columns) DO
-- UPDATE`, with no `WHERE` — confirmed live, the exact same 42P10 comes back even naming the
-- right columns when the matching index carries a predicate, because Postgres can only infer an
-- ON CONFLICT target from an index whose definition it can match verbatim. A plain unique index
-- still gives the isolation this table needs without the predicate: Postgres never considers two
-- NULLs equal in a unique index, so two `products` rows that both have `node_id = null` (every
-- brand-owned row) never collide with each other on THIS index — they just don't collide with
-- ANYTHING through it, which is exactly what `products_brand_external_idx` is for instead.
create unique index if not exists products_node_external_idx
  on public.products (node_id, platform, external_id);

create unique index if not exists products_brand_external_idx
  on public.products (brand_id, platform, external_id);
