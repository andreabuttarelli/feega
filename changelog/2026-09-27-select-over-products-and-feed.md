# `select` picks from products and social feed too, not only a `list`

`select` only resolved its index against a connected `list` node. Products and social feed are
intrinsically lists — N synced rows in a fixed order — but a `select` couldn't be wired to either.

## What changed

- `select-node.ts::SELECTABLE_SOURCE_TYPES` (`list`, `products`, `social_account_feed`) is the one
  table both the client preview (`listFeedingSelect`) and the server resolver
  (`upstream.ts::listFeeding`) read to decide what counts as a source — replacing the old
  `source.type === 'list'` check in both places.
- `select-sources.ts` (new, pure) converts one product/post into what a `select` item gives
  downstream: `productItem` joins title+description as text and lists every product image;
  `socialPostItem` gives the caption as text and every slide of the post as media — reading
  `media.items` (a carousel's ordered slides) when present, falling back to
  `thumbnailUrl`/`videoUrl` for a single-image post.
- `upstream.ts::toUpstreamNode` gained a `products`/`social_account_feed` branch (also used
  directly, not just through `select`) and the `select` branch now dispatches on the source's
  type: a `list` keeps going through `resolvedListValues`/`itemAt`, `products`/
  `social_account_feed` go through the new `syncedSourceItems`/`syncedItemAt`. A select on a
  carousel post emits all its slides as `mediaUrls`, feeding a multi-reference connector the same
  way `influencer` already does.
- `graph.ts`: `select`, `products`, `social_account_feed` were never in `NODE_KINDS` — every edge
  *into* a `select` (or into products/feed) was rejected client-side as "tipo sconosciuto", a
  pre-existing bug this surfaced. All three are now real `NodeKind`s with specs, so `canConnect`
  actually validates edges to/from them instead of always refusing.
- `loop-axes.ts::axesFrom` used the same `type !== 'list'` gate for what can be a loop axis;
  swapped for `isSelectableSourceType`, so an `iterate` edge from `products`/`social_account_feed`
  is now a valid axis too. `loop.ts::axesForNode` counts items for whichever source type it finds
  (`itemCountOf`), and the `iterateSelection` path in `upstream.ts` resolves one product/post per
  iteration the same way `select` does.
- `describe_node_types` (MCP) updated: `select` now documents pulling from `products`/
  `social_account_feed`, not only `list`.

## Verification

Unit: `select-node.test.ts`, `select-sources.test.ts`, `connect-rules.test.ts`, `graph.test.ts`,
`loop-axes.test.ts` — new cases for products/feed as select source and loop axis.
`upstream.test.ts` — three new cases through the real `upstreamInputsFor`: select on a synced
product returns title+description+photo at the chosen index, select on a feed post with
`media.items` returns every slide, select on a single-image post falls back to the thumbnail.

Live, against project `5ae78d0a-a983-418e-b646-c25478644dc0` (canvas
`62bfe051-2176-4c4b-b467-9053a5937067`, real synced `social_account_feed` node with 20 Instagram
posts): created a temporary `select` node wired to that feed and a temporary downstream node
through the real `upstreamInputsFor`, changed `index` from 1 to 3, confirmed the resolved post
differed — then deleted both temporary nodes. No paid generation ran.
