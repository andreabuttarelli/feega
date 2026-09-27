# `products` and `social_account_feed` nodes downloaded nothing

Reported by the user: neither the store URL in a `products` node nor the handle in a
`social_account_feed` node ever pulled anything in. Traced end to end against the real
dev server with a disposable org/project (`playwright-core`, `chromium.launch({channel:
'chrome'})`), a public Shopify store (allbirds.com) and a real Instagram handle (nike).

## Root causes — two separate bugs, one per node type

**`products` sync: 500 on every sync, `42P10`.** `repos/products.ts::upsertNodeProducts`
upserts with `onConflict: 'node_id,platform,external_id'`, and `insertBrandProducts`
with `onConflict: 'brand_id,platform,external_id'`. No migration in this repo ever
created either matching unique index — both were referenced only in code comments.
Confirmed live: raw SQL through a direct Postgres connection resolved `ON CONFLICT
(node_id, platform, external_id) WHERE node_id IS NOT NULL` (an index someone had
hand-applied), but the SAME query through PostgREST (what `supabase-js`'s `.upsert()`
actually sends) still failed with `42P10` — because PostgREST always emits `ON CONFLICT
(columns) DO UPDATE` with **no** `WHERE`, and Postgres can only match an `ON CONFLICT`
target to an index whose definition is identical. A **partial** unique index can never
serve as a PostgREST upsert target, no matter how correctly it's named.

Fix: `supabase/migrations/20260927130000_products_node_external_idx.sql` creates both
indexes **without** the `WHERE` predicate. Two NULLs still never collide in a plain
unique index — the partiality was never needed for the "two null owners don't collide"
property the code comments described, only redundant with it, and that redundancy is
exactly what broke the upsert. This migration could not be applied from this session
(schema changes to the shared database require explicit approval) — it is written and
ready, not yet run against `klnswzhhgrqvbfjzioul`.

**`social_account_feed` sync: succeeded, but every thumbnail was a dead link waiting to
happen.** `fetchProfileHistory` (`scrapecreators.ts`) returns `thumbnailUrl` as a signed,
short-lived platform-CDN URL, and `social-feed-sync.ts` wrote it straight into
`social_posts.media` with nothing re-hosting it — the same class of bug
`archiveHistoryThumbnails` already exists to prevent for brand history, just never wired
for this node.

A second, related gap: `NormalizedPost` only ever kept the FIRST slide of a multi-image
post (Instagram `carousel_media`, TikTok `image_post_info.images`, X
`extended_entities.media` with more than one entry) — every slide after the first was
silently dropped before it ever reached the database.

## What changed

- `scrapecreators.ts`: added `NormalizedPost.items` — every slide of a post, in order.
  Instagram, TikTok and X map every slide their API actually returns; every other
  platform's mapper fills a single-element `items` from the fields it already had, so
  `items` is always the canonical list, never optional-shaped per platform.
- `social-feed-sync.ts`: `syncSocialFeedNode` now archives each slide's `thumbnailUrl`
  into the `canvas-assets` bucket (`${orgId}/${nodeId}/<hash>.jpg`) before the post is
  written — the same durability move `archiveHistoryThumbnails` makes for brand history,
  aimed at a node instead of a brand (a `products`/`social_account_feed` node has
  neither, by design — see `NEW_DATABASE_STRUCTURE.md`).
- `repos/social-posts.ts`: `mediaOf` stores each item's `thumbnailPath` alongside the
  original url; `listNodeSocialPosts` signs every archived path at read time
  (`signAssetFiles`, the same helper canvas uploads already use) and substitutes the
  signed URL for the raw one — a path that never archived (dead link at fetch time)
  falls back to the original url, same as before.
- `media-archive.ts`: `archiveImageToBucket` takes an optional `bucket` argument
  (defaulted to `brand-knowledge`) instead of being hardcoded to it — `canvas-assets`
  needed the same archiving without a brand in scope.
- `SocialFeedNode.svelte`: a post with more than one slide shows inner prev/next arrows
  and a dot indicator over the photo; a single-slide post is unchanged.

## Verification

`social-posts.test.ts`, `social-feed-sync.test.ts`, `scrapecreators.carousel.test.ts`,
`media-archive.test.ts` — 45 tests total, all red before the fix (verified individually
per Kent Beck's method), all green after. Live in the browser: a real sync against
`nike` on Instagram landed a `<img>` src pointing at our own signed `canvas-assets` URL,
not the Instagram CDN, and a carousel post rendered its dot indicator (screenshots in
this session's scratchpad). The `products` fix could not be verified live — it needs the
migration applied first.
