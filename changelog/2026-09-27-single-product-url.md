# Products node: paste one product, not just the whole store

Before this, the Products node only knew one shape of URL: a store root, and
it always downloaded the full catalogue (`/products.json`, WooCommerce
`/wp-json/wc/store/v1/products`). Pasting a link to one product had no
effect other than syncing everything.

`classifyStoreUrl` (`store-fetch.ts`) is the one table that reads what a
pasted URL means, per platform:

| URL shape | scope | what happens |
|---|---|---|
| store root | `store` | catalogue page, as before |
| `/collections/<c>` (Shopify) | `collection` | category set from the URL, catalogue page filtered to it |
| `/products/<handle>` (Shopify), `/collections/<c>/products/<handle>` | `products` | that one product only |
| several of the above, one per line or comma-separated | widest scope wins — a mix of a product URL and a collection URL syncs the collection |

Platform detection from the URL only applies to Shopify — its path
convention (`/products/<handle>`, `/collections/<c>`) is fixed; WooCommerce's
permalink is configurable per store, so a Woo URL can't be told apart from a
plain domain by shape alone. The platform field on the node still decides in
that case.

New fetchers in `store-fetch.ts`: `fetchShopifyProduct` reads
`/products/<handle>.json`, `fetchWooCommerceProductBySlug` queries the Store
API with `?slug=`. Both reuse the existing SSRF guard
(`tool-guard.ts::safeFetchUrl`) — no new bypass.

`syncProductsNode` (`products-sync.ts`) classifies the URL first, then picks
the fetcher: one call per handle for `products` scope, the existing paged
fetch otherwise. Outcome now carries a `summary` string — `"1 product"`,
`"2 products"`, `"collection: mens-shoes"`, `"whole store"` — persisted on
the node as `sync_summary` (`ProductsNode.syncSummary`) so the inspector can
say what it understood without re-fetching.

Verified for real (no AI cost): `syncProductsNode` against a live Shopify
store (allbirds.com) — a single product URL synced exactly one row, a
collection URL synced its page, a root URL kept the old whole-catalogue
behavior.

Discarded: guessing WooCommerce from URL shape — there's no fixed pattern to
match, and guessing wrong would silently sync from the wrong endpoint.
