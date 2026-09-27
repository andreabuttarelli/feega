# Products and social feed: a right-side inspector, filters, and a preview grid

The two source nodes carried their whole configuration in a cramped header on the node (platform,
url/handle, a sync icon) and showed one item at a time in a carousel. There were no filters at all,
and `limit`/`only_first_photo` were only reachable through MCP.

## What changed

- **One field table per type** (`src/lib/canvas/node-inspector.ts`: `PRODUCT_FIELDS`,
  `FEED_FIELDS`, registry `INSPECTORS`). Each row names a path on the node (`filters.min_likes`),
  a kind, and whether it applies at **fetch** (next sync) or at **read** (immediately).
  `NodeInspector.svelte` renders any table; it is not written per node. Adding a filter is a row.
- **Filters live in `data.filters`** (optional, backward compatible — old rows read as defaults):
  products `query/price_min/price_max/in_stock_only/sort`, feed
  `from/to/media/min_likes/min_views/include/exclude/sort`. Products also gain `category`
  (fetch-time). Zod schemas in `node-data.ts` extended, so `describe_node_types` (derived from
  them) shows the new fields with no hand-written copy.
- **Fetch vs read.** Only `category` is a provider parameter: Shopify reads
  `/collections/<handle>/products.json`, WooCommerce `&category=<slug>`. Everything else is a
  read filter, because ScrapeCreators takes no date/metric/media params and a read filter changes
  the preview instantly without spending a sync. Rows from a previous category stay until the
  next sync overwrites them — upsert never deletes; accepted for now.
- **One pure filter** (`source-filters.ts`: `filterProducts`, `filterPosts`) used by the node
  preview and the select/loop counts on the page, and by `server/canvas/synced-items.ts`, which
  `upstream.ts` (select + loop iteration) and `loop.ts::itemCountOf` now share. Before, the two
  server files each listed rows on their own; now select index N and loop axis size both see the
  filtered list.
- **Input normalization.** `normalizeHandle` strips `@` and extracts the username from profile
  URLs (instagram, tiktok `@`, youtube `@`, linkedin `company/`); store URLs go through
  `normalizeUrl` (`$lib/ads-fee`). Applied when the field is committed and again in the `sync`
  action, so an agent writing a raw URL through MCP still syncs the right account.
- **Preview.** `SourcePreview.svelte` draws a 3-column grid with carousel/video badges and a
  `shown/total` count; `ProductsNode`/`SocialFeedNode` only map rows to tiles.
- **Selection.** `CanvasFlow` gained `onSelectionChange`; the page opens the inspector when
  exactly one inspectable node is selected. Writes go through the existing `write` (optimistic
  concurrency on `nodes.version`). Sync cost shown as free — syncing calls no AI provider.

## Discarded

- Date range at fetch: no provider parameter exists; filtering stored rows is equivalent.
- A separate inspector component per node: two hand-written forms diverge at the first new field.
