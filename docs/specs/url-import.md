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

The page is read once, frozen, and the tree, the raster snapshots and the fidelity reference
screenshot all come from that same frozen state.

`pagePrepared` (`import-url.ts`):

1. Before the first script (`tab.seeAll`): every IntersectionObserver reports its targets in view
   (`everythingInView`); `heldStill` makes every shadow root open, and gates rAF, scroll / resize /
   pointer / focus / visibility listeners, `matchMedia` listeners and ResizeObserver callbacks on
   `__feegaStill`, so nothing the page registered can move it once frozen.
2. The page settles, scrolls to the bottom in 700 px steps and back. At each step `inViewSampled`
   records, for every element with an animation or inline transform/opacity/filter/clip/visibility,
   the state it reached while on screen: the most visible one (highest opacity, then closest to the
   centre) among the steps where at least half of it was in view.
3. Back at the top, two samples a beat apart mark as restless what moves without scrolling
   (tickers, rAF loops): those are never pinned.
4. `revealPage(Moving)` finishes animations, puts infinite ones and GSAP loops at their start,
   carousels (Swiper, Splide, Flickity, Slick) on their first slide, stops videos, hides cookie
   banners (also under `<html>` and in shadow roots).
5. `revealPage(Still)` sets `__feegaStill`, clears timers, pins every sampled element to its
   in-view state with inline `!important` values, keeps cookie banners hidden as they appear
   (a MutationObserver on the document and on every shadow root), and pauses infinite animations
   created later at their start.

`tab.tree()` runs `treeScript` with the `@font-face` rules of cross-origin stylesheets read from
the network responses (the page cannot read or fetch them), then takes the raster snapshots
(`page-snaps.ts`); a canvas, video or iframe is replaced by its own snapshot afterwards, so
anything read later sees the same frame. Snapshots see `clipPath` and `mask` sources even when
the rest of the page is hidden.
## DOM → doc

The page is serialized as a Figma REST-shaped tree, then the existing Figma importer builds the
doc. In-page helpers (`page-kit.ts`) are self-contained so they survive being sent as text.

| DOM | Tree | Doc |
|---|---|---|
| inline formatting context (text + `span`/`a`/`code`…) | one TEXT with styled runs; one TEXT per line when lines do not share an edge; inline backgrounds and borders as rectangles under it; an inline box's margin + border + padding as letter spacing after the letter before it and after its last letter; box width halfway between the widest line and where the next word would have fit, so the same lines break | Text clip with runs (run `tracking`) |
| `font-variation-settings`, optical size, `font-feature-settings`, `text-transform`, `letter-spacing`, line height | `fontAxes`, `fontFeatures`, transformed characters, px values | `axes`, `features`, `lineHeight`, `letterSpacing` |
| `@font-face` the text uses | `tree.fonts` → org fonts | uploaded font faces, one variant per used weight |
| flex container whose items sit exactly where the gap, padding and alignment put them (±0.5 px), no item spilling out of its box | FRAME + `layoutMode`; items as boxes | auto layout |
| anything else | FRAME / GROUP, absolute children | fixed positions |
| `z-index`, positioned and stacking elements | children sorted by paint order; z-indexed and fixed descendants lifted out of non-stacking parents | layer order |
| `overflow` hidden/clip, `clip-path: inset()` | `clipsContent`; hidden copies dropped | clip |
| background colour, linear/radial/conic gradients, `background-clip: text` | SOLID / GRADIENT_* paints (handles in the box) | fills |
| `background-image: url()` cover/contain, positioned | IMAGE paint with `scaleMode` and `imageFocus`; other sizes as a positioned rectangle; tiled → snapshot of the element's own paint | image fill |
| `<img>` with `object-fit` / `object-position` | IMAGE paint with fit and focus | image fill |
| inline SVG, `<img src=*.svg>` | VECTOR per shape with the exact path (arcs, `use`, symbols, gradients, `currentColor`); a `clip-path` to a single unrotated `rect` as a clipping FRAME | Shape path |
| borders per side, outline, box-shadow (inset too), `filter: blur`, `backdrop-filter: blur`, radius per corner | strokes or side rectangles, effects | strokes, effects |
| `::before` / `::after` | real elements before the walk | as any element |
| video, canvas, iframe, masked / blended / filtered / rotated blocks, native controls | snapshot RECTANGLE | image fill |
| an element partly off the page | box cut at the edge, picture focused on the part that was showing | — |

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

The HTML still is not what the canvas draws. `URL_IMPORT_GPU=<label> npx vite-node --config
scripts/vite-node.config.ts scripts/url-import/gpu-fidelity.ts` (optional `URL_IMPORT_CAPTURED`,
`URL_IMPORT_ONLY`, `URL_IMPORT_GPU_BACKEND=webgl`, `URL_IMPORT_GPU_HEADED=1`) puts the same plan
frames in a GPU core world as `CoreFrames.svelte` does, screenshots the canvas band by band and
writes `<page>-gpu-*.png`, `<page>-gpu-score.json` and a `gpu-<backend>.md` table next to the
HTML scores of the same label. Both harnesses stretch each frame into its node box, like the
canvas.
