# Import from URL

Paste a public web page URL, get an editable frame: layers, text, auto layout, images. Not a
screenshot, not an iframe. ADR `docs/adr/0026-url-import-through-figma-scene.md`.

## Flow

UI "Import from URL…" / `POST /api/v1/projects/:id/url-import` / op `import_url` (MCP `edit`,
CLI `feega import-url`) → `importUrlInto` (`src/lib/server/url-import/canvas-import.ts`) →
`importPageAt` → browser tab (`liveBrowser`) → `pageTreeOf` in the page → `urlPlan` →
`placeFigmaPlan` → `nodes` + `motion_revisions` → images through `importCanvasLink` into
`canvas-assets`, then `imagesFilled`.

## Rules

- Public http(s) only. `assertPublicUrl` before opening the tab (DNS resolved, private,
  loopback, link-local and metadata ranges refused); every sub-request and redirect of the page
  goes through the same check (`fenced` request interception). Downloads denied. No cookies or
  saved sessions are loaded.
- Caps: 10 000 nodes, page height 65 536 px (frames of 16 384 px stacked), text 4 000 chars per
  node, 200 images, 48 raster snapshots, 20 s navigation, 4 imports per user per minute.
- Desktop width 1 280 px. Hidden, transparent and off-page elements are skipped.
- Frame named after the page title (host when there is none).

## Capture

`pagePrepared` (`import-url.ts`): every IntersectionObserver reports its targets in view from the
first script (`everythingInView`), the page settles, scrolls to the bottom and back, finishes
animations, stops videos on their last frame, hides cookie banners (`revealPage`), then freezes
timers, rAF, `play()` and transitions (`RevealMode.Still`). `tab.tree()` runs `treeScript` and then
takes the raster snapshots the tree asked for (`page-snaps.ts`, isolated from the rest of the page).

## DOM → doc

The page is serialized as a Figma REST-shaped tree, then the existing Figma importer builds the
doc. In-page helpers (`page-kit.ts`) are self-contained so they survive being sent as text.

| DOM | Tree | Doc |
|---|---|---|
| inline formatting context (text + `span`/`a`/`code`…) | one TEXT with styled runs; one TEXT per line when lines do not share an edge; inline backgrounds as rectangles under it | Text clip with runs |
| `font-variation-settings`, optical size, `font-feature-settings`, `text-transform`, `letter-spacing`, line height | `fontAxes`, `fontFeatures`, transformed characters, px values | `axes`, `features`, `lineHeight`, `letterSpacing` |
| `@font-face` the text uses | `tree.fonts` → org fonts | uploaded font faces, one variant per used weight |
| flex container whose items sit exactly where the gap, padding and alignment put them (±0.5 px), no item spilling out of its box | FRAME + `layoutMode`; items as boxes | auto layout |
| anything else | FRAME / GROUP, absolute children | fixed positions |
| `z-index`, positioned and stacking elements | children sorted by paint order; z-indexed and fixed descendants lifted out of non-stacking parents | layer order |
| `overflow` hidden/clip, `clip-path: inset()` | `clipsContent`; hidden copies dropped | clip |
| background colour, linear/radial/conic gradients, `background-clip: text` | SOLID / GRADIENT_* paints (handles in the box) | fills |
| `background-image: url()` cover/contain, positioned | IMAGE paint with `scaleMode` and `imageFocus`; other sizes as a positioned rectangle; tiled → snapshot of the element's own paint | image fill |
| `<img>` with `object-fit` / `object-position` | IMAGE paint with fit and focus | image fill |
| inline SVG, `<img src=*.svg>` | VECTOR per shape with the exact path (arcs, `use`, symbols, gradients, `currentColor`) | Shape path |
| borders per side, outline, box-shadow (inset too), `filter: blur`, `backdrop-filter: blur`, radius per corner | strokes or side rectangles, effects | strokes, effects |
| `::before` / `::after` | real elements before the walk | as any element |
| video, canvas, iframe, masked / blended / filtered / rotated blocks, native controls | snapshot RECTANGLE | image fill |
| an element partly off the page | box cut at the edge, picture anchored to it | — |

## Components

`repeatedOf` (`src/lib/server/url-import/repeated.ts`) runs on the tree before `restMessage`.

- Skeleton signature: type, auto layout direction, text size/weight, image fill presence, recursively; text,
  image src and colours ignored.
- Candidate: FRAME/GROUP, ≥2 nodes, ≥16 px per side, painted or with image/icon; inside auto layout too.
- Same skeleton → one set; root style (fills, strokes, radius, effects, opacity) → variant
  (`Style=Primary|Secondary|…`). Size is not part of the key: a copy of another size is an instance with a
  size override. Kept when ≥2 copies.
- Outermost wins: nothing nested inside an occurrence becomes a component.
- Occurrences become `INSTANCE` nodes whose `componentId` is the first copy; that copy is the main, placed
  where it was. Names from a rule table (logo, button, nav link, link, list item, card, feature card).
- Figma scene: an instance builds its own layers at the main's position and diffs them with the main
  (`instance-diff.ts`). Differences on any clip become overrides (text, fills, geometry, auto layout,
  layout item); inside nested groups they are path overrides. Images that differ on top-level clips
  become per-instance image slots. A different layer count, or a different image inside a nested group,
  leaves the copy unlinked. An instance that draws its own layers links even when its size
  differs from the main.
- Rendering: an instance with overrides is laid out again after they apply (`instanceTracks`), a group's size in a flow is the size of what it shows (instances
  included), and a frame without auto layout inside a flow keeps its box as an invisible background.

## Not yet

- Tablet/phone captures as breakpoint overrides (ADR 0022).
- Dashed strokes, `mask-image` and `mix-blend-mode` as layers (they come in as snapshots).

## Fidelity

`URL_IMPORT_CAPTURE=<label>` (`url-capture.browser.test.ts`) captures the pages in
`fidelity-pages.ts` as the import reads them, plus a reference screenshot;
`URL_IMPORT_FIDELITY=<label>` (`url-fidelity.browser.test.ts`) draws the plan and scores SSIM above
the fold and over the whole page. Output in `~/Documents/feega-videos/url-import/fidelity2/`.
