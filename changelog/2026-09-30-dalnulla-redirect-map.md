# dalnulla.com redirects to real pages

Before: `dalnulla.com/<path>` was sent to `feega.app/<path>` unchanged. Framer
has none of the old tool paths, so every old URL with Search Console traffic
(80 pages, 185 clicks/period) ended on a 404 after two hops
(`feega.app` → `www.feega.app`).

Now `host-redirects.ts` maps each old path to its best target in one hop on
`https://www.feega.app`: a table of exact paths, a table of prefixes
(`/tools/*` → styles hub, `/app*` → the app), localized hubs for `/it` and
`/es`, home as fallback. `/sign-in` goes to `oh.feega.app/login`. 308 kept,
query string kept.

The targets are Framer pages created unpublished in the same work
(`docs/seo/strategy.md`): the site must be published before this ships.

Discarded: mapping each localized tool to its English page (IT/ES visitors
get a page in their language instead); a Framer-side redirect table (the plan
does not include redirects).
