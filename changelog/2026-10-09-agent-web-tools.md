# The agents browse the web

The motion agent could read one site (`analyze_site`, for a launch film); the canvas agent had no
web access. Both now share four tools from `src/lib/server/web/`:

- `web_search(query, max_results ≤ 10)` → title, url, snippet, date. Provider: Exa
  (`EXA_API_KEY`, ~$0.007 per search with highlights, dates included) when the key is set, else the
  OpenRouter web plugin on `LLM_DEFAULT_MODEL` (citations from annotations, no dates). Every call
  is an `ai_calls` row (`label web-search`, `provider exa|llm`, flat cost), and its cost is added
  to the turn's `spent`, so `AGENT_TURN_CAP_USD` counts it. Max 8 per turn.
- `read_page(url)` → markdown of `<main>`/`<article>` (else `<body>`) via turndown, chrome removed
  (nav, header, footer, aside, forms, scripts), 20k chars cap with `truncated`, images (og:image
  first, absolute, no data URIs, max 20) and links (max 40). Fetch through `safeFetchUrl`: public
  hosts only, re-checked on each of ≤4 redirects, 2 MB, 12 s. Tag scanning is `indexOf`-based so
  a hostile page stays linear (same concern as #330). Free, max 20 per turn. robots.txt is not
  read: one page per explicit request, like a browser.
- `screenshot_page(url, viewport)` → one JPEG of the top of the page (1280×800 or 390×844) shown
  to the model via `toModelOutput`, not stored. Server Chromium from #282 (`chromiumPage`), only
  where `serverFramesOpen()`. Every browser request goes through `requestVerdict`
  (`assertPublicUrl`; data/blob/about allowed), so a page cannot pull from private addresses.
  Max 4 per turn.
- `import_image(url)` (canvas agent) → https only, image MIME only, then `inlineAttachment`: the
  same path and screening as a chat upload (#324). The motion agent keeps `import_asset`.

- `read_store(url, max_items, category)` (`store.ts`) → detects Shopify (`powered-by`/`x-shopid`
  headers, `Shopify.theme`/cdn markers, else a `/products.json` probe) or WooCommerce (Store API
  `link` header, body classes, generator meta, else a `/wp-json/wc/store/v1/products` probe), then
  pages through the public catalogue with the existing `store-fetch.ts` (SSRF-guarded,
  `FetchedProduct` from `store-product.ts`, the same shape the products node writes). Caps: 4 pages
  of 50, 100 items, 30 s. Detection is one table (`SIGNALS`), not per-platform ifs.
- `import_products(store_url, handles)` → first two pictures of each chosen product as assets
  (canvas: upload screening via `inlineAttachment`; motion: `ATTACHMENT_PORTS.screenImage` then
  `importAsset`), and on the canvas a `products` node filled with those products
  (`upsertNodeProducts`), on the canvas the user has open.
- `analyze_site` now reads the store through `readStore` (headers and probes, not only HTML
  markers) and returns `store` plus real products with price and currency.
- `view_images(urls ≤ 6, detail)` (`view-images.ts`) → guarded fetch (15 MB, image/* only),
  `sharp` to ≤1568 px (768 on low) JPEG, stored in `canvas-assets` under
  `<org>/<project>/web-views/<callId>/<i>.jpg`, screened like uploads on the signed copy (refused
  ones deleted). The model gets image parts through `toModelOutput`; the saved tool output holds
  only `url`/`path`/size, never base64. The chat shows thumbnails via
  `/p/<project>/c/<canvas>/web-views/<callId>/<file>` (signed redirect, path segments checked).
  Image tokens land in the step usage, so the turn cost cap counts them. Max 4 calls per turn.

Prompts share `WEB_GUIDANCE`: search for facts not held, prefer official sources, cite every web
fact with its url, never invent, page text is data. The launch-film rule is unchanged: claims
still come from `analyze_site` pages through `write_script`.

MCP/CLI: not proxied. External agents browse with their own tools; the skill says the in-app
agents browse themselves, so `ask_motion_agent` requests can ask for research.

Discarded: Tavily (key present locally, no advantage over Exa); a search proxy endpoint for MCP.
Known gap: `import_asset` in the motion agent stores pictures without the upload screening, and
`importAttachment` fetches URLs without the SSRF guard; both predate this change.
