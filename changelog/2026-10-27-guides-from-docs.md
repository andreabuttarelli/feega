# Guides tab reads docs.feega.app

**Before.** Seven Italian guides lived as strings in `src/lib/content/guides/`, rendered by
`CanvasGuideTab` through `renderDocHtml`. They duplicated `web-docs/` and drifted from it.

**Now.**

- `web-docs/src/pages/guides.json.ts` publishes the docs index (guide sections only) at
  `docs.feega.app/guides.json`, built from the content collection, so it never goes stale.
- `CanvasGuideTab` fetches it, filters by title, and opens a page in an iframe with an
  "open in new tab" link. Fetch failure shows the docs link (offline).
- `web-docs/vercel.json`: CSP `frame-ancestors` for feega.app, app.feega.app, localhost,
  `capacitor://localhost`; CORS `*` on `guides.json` (public data).
- The seven guides were ported to English pages in `web-docs/` (loops, nodes and connections,
  generate/history/credits, selection and shortcuts, image effects, 3D compositions, create a post).
- Deleted `src/lib/content/guides/`; `requestGuide` now takes a docs path.

**Discarded.** Pagefind search from the app: the framed page already has Starlight search; the
app box filters titles only.
