# Shared canvas links render every node type

`/s/[token]` rendered only `image`, `video`, `text`, `doc`, `iframe`; the other nine types fell
through to `{ kind: 'empty' }` and showed a blank tile.

## What changed

- `SHARED_VIEW_OF` in `canvas-share.ts` is now `Record<NodeType, …>` — a missing type is a
  compile error, and `canvas-share.test.ts` asserts its keys equal `NODE_TYPES`.
- `products` / `social_account_feed`: rows read by node and org (`listNodeProducts`,
  `listNodeSocialPosts`), filtered with the node's saved filters (`filterProducts`,
  `filterPosts`), rendered through `SourcePreview.svelte`. Tile keys are indexes, not row ids.
- `effects` / `composition`: only the output asset (`refId`), signed; params never leave.
- `influencer`: name, summary, first view signed from the `influencers` bucket. Only catalogue
  (`org_id` null) or same-org rows pass — service role bypasses RLS, so the check is in code.
- `list` (items, `asset_id` signed), `select` (index), `social_post_mockup` (general caption and
  media URLs), `ads` (page name or search terms and country — never `page_id`).
- `SignPaths` gained an `influencer` bucket; `service-role-uses.ts` lists the new tables.

## Discarded

- Reusing editor node components: they are wired to xyflow props and inspectors.
- Resolving `select` against its upstream list: needs edge resolution; the index is enough.
- Ads creatives: no canvas sync writes `competitor_ads` by node today, so there is nothing to show
  beyond the query.
