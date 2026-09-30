# Products: sale price, tags, vendor, type, SKU, variants, options

Before: `products` stored title, description, first-variant price, images,
availability. The select-outputs change deferred compare-at price and tags
because the table did not have them.

Now:

- Migration `20260930090000_products_richer_fields.sql` (additive, nullable):
  `compare_at_price numeric`, `tags text[]`, `vendor`, `product_type`, `sku`,
  `variants jsonb`, `options jsonb`. Applied to `klnswzhhgrqvbfjzioul`.
- `store-product.ts` holds the one platform → normaliser table
  (`PRODUCT_NORMALISERS`); `store-fetch.ts` only fetches. Moved in its own
  commit, behaviour unchanged, then extended.
- Shopify: compare-at and SKU from the first variant; `tags` accepted as the
  comma string (`/products/<handle>.json`) or array (`/products.json`);
  variants map `option1..3` to option names; product `available` falls back
  to "any variant available" (products.json carries it only on variants).
- WooCommerce Store API: compare-at = `regular_price` only when `on_sale`;
  `tags`/`brands`/`categories` by name, vendor = first brand, product type =
  first category (Woo has no product type). Variants come from `variations`
  (id + attributes only): the list endpoint embeds no variation price/SKU/stock,
  and no extra request per product was added.
- Discount is derived, never stored: `discountPercent` in
  `canvas/product-discount.ts` (null when no compare price, compare ≤ price,
  or it rounds to 0). Used by the Select field, the on-sale filter and the
  `−N%` badge (canvas preview and share view) — one function.
- Filters: `on_sale_only`, `tag`, `vendor`, `product_type` (case-insensitive
  exact) in `source-filters.ts`, the zod schema (so `describe_node_types`
  reflects them) and the inspector field table.
- Select fields: `compare_at_price`, `discount_percent`, `tags`, `vendor`,
  `product_type`, `sku`, `variants` (titles, sold-out marked), `options`
  (`Color: Red, Blue` per line).
- Brand wizard products (from site analysis) write the new columns empty.

Verified live against allbirds.com (250 products, 138 on sale) and
woocommerce.com's Store API (100 products; none on sale in that page).
