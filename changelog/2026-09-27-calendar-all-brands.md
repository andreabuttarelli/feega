# Calendar: brand dropdown, "All" by default

**Why.** The calendar showed only the project's linked brand and blocked the page with a
"link a brand" overlay otherwise. Posts belong to brands, not projects, so the project link was
the wrong gate.

**What.**
- `?brand=<slug|all>` picks the brand; default and unknown slugs fall back to all org brands.
  With "All" every chip carries the brand (logo or initials on a per-brand tone).
- Overlay only when the org has zero brands; the calendar's `linkBrand` action is removed (the
  project link still lives in Settings → Project).
- Popover: schedule on the post's own brand accounts, reschedule per delivery ("Sposta").
- Actions resolve the post inside the project's org first: a foreign post is a 404, not a 500
  from an uncaught `post_not_found`. Accounts are always looked up on the post's brand.
- Create post: the composer sent only media node ids, so a text-only selection was rejected with
  `brand_and_nodes_required` and nothing visible happened. Caption nodes are now sent too.

**Not verified end to end.** Schedule/reschedule/cancel need a connected account on Zernio; the
walk stopped before any real provider call.
