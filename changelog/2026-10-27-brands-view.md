# Brands panel: Kit / Products / Posts / Ads

**Before.** Opening a brand listed its pieces (logo, colours, document, handles, store,
website, plus name and description rows nobody dragged). Products, posts, scraped social
posts and competitor ads were in the database and invisible on the canvas.

**Now.**

- `brand-library.ts`: the tabs, `libraryDrag` (media → static image/video node by asset id,
  else text), `firstMedia` (first http url in any jsonb shape: `products.images`,
  `social_posts.media`, `competitor_ads.media` have no fixed shape) and `engagement`.
- `server/brand-library.ts`: one loader per tab. External media becomes an imported asset
  (`findOrCreateImportedAsset`, idempotent), the same rule the logo already follows, so
  `dragstart` stays synchronous. Top social posts are matched by the brand's account
  handles: `social_posts` has no `brand_id` yet (phase 3).
- Routes: `agent/brands/:brandId/library?tab=` (session) and `/api/v1/brands/:slug/library`
  (Bearer). Contract `GET_BRAND_LIBRARY` → MCP `get_brand_library`, CLI `feega library`.
- Kit drops the name and description rows.

Discarded: dragging a post as a `social_post_mockup` and an ad as an `ads` node. Both node
types are built to fetch or render their own content; a still of the creative is what a
designer reuses.
