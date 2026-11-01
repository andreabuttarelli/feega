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

`tab.tree()` runs `treeScript`, then takes the raster snapshots (`page-snaps.ts`); a canvas, video or iframe is replaced by its own snapshot afterwards, so
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
| content of a closed `<details>` | nodes marked `collapsed` | hidden clips (`hidden: true`) |
| dashed / dotted border, SVG `stroke-dasharray` | `strokeDashes` (Chrome's pattern) | stroke `dash` / `gap` |
| `mix-blend-mode` on a block without element children | `blendMode` (Figma names) | clip `blend` |
| `mask-image: linear-gradient(...)` (one layer, default size and position) | `maskGradient`, frame clips its content | precomp with `rect` masks for opaque runs and `linear` masks for fades |
| video, canvas, iframe, native controls; image / radial masks, filters, clip paths, blends and rotations on blocks without text, links or controls | snapshot RECTANGLE | image fill |
| the same effects on a block holding text, links or controls (`holdsContent`) | the block as layers: `drop-shadow()` → DROP_SHADOW, blend → `blendMode` on its leaves, several linear mask layers → one backdrop-coloured gradient veil each on top (`veilsOf`, product of the masks), other masks, filters and clip paths → a snapshot of the block's own paint as its background (`own` mode) | layers |
| `matrix3d` with no rotation and no perspective (`translateZ`) | the 2D part of the matrix, not a rotation | — |
| a word split into one inline-block span per letter | one TEXT (`lettersJoined`), a space where the gap is over 0.2 em | text |
| an element partly off the page | box cut at the edge, picture focused on the part that was showing | — |

## Sections

On by default (`sections: false` / `--no-sections` / the dialog checkbox turn it off). The page frame's
direct children become section frames in a vertical auto layout, top to bottom.

- `page-outline.ts` reads, after the tree, the full-width blocks (≥50% wide): tag, role, aria-label,
  id/class words, first h1–h3, background, picture/blockquote/details counts, fixed/sticky.
- `page-sections.ts` (pure, outline → `{ name, top, bottom }[]`): opens `main`/`body`, the wrapper
  spine, wrappers over 1200 px or with one child; stops at landmarks; drops blocks contained in a
  sibling (overlays, cookie bars); a top nav may overlap the next block. Adjacent generic blocks merge
  unless the later one has a heading, a name, another background, or a gap ≥160 px. Names come from
  `SECTION_NAMES`, one row per name; else `Section N`.
- `section-frames.ts` cuts the tree per band with `windowed`: text and vectors go whole to the band of
  their top, the rest is cut, so every box stays where it was. Empty bands join the next.
- `import_code` keeps one tree.

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

## Tokens

On by default (`tokens`, CLI `--no-tokens`). `page-tokens.ts` clusters and names colours, text
styles, shadows, radii and spacing by rule tables (`COLOUR_ROLES`, `TEXT_RULES`); `token-bind.ts`
writes them as the frame's variable collection (named after the site) and styles (`<Site> Body`)
and binds the layers whose value matches. A brand of the same host pulls close colours to its
palette. Borders, radii and the frame background are listed, not bound.

## Breakpoints

With `breakpoints: true` (API, MCP `import_url`, CLI `--breakpoints`, dialog checkbox) the page is
read again at 768 and 390 px (`PAGE_VIEWS`, `tab.viewport`), each with the same freeze. The
frame gets Tablet and Phone breakpoints (ADR 0022) whose overrides make each view look like the
page at that width:

- The walker names every layer by where it sits in the DOM (`RestNode.key`: element path, `~n`
  for the n-th text run of an element, `.i` for a line). Keys match across widths.
- `joinedTree`: a paragraph the walker split into lines comes in as one wrapping text (alignment
  read from the line edges), on every read, so it can rewrap at another width.
- `withExtras`: layers only a narrower page shows (a phone menu) are added to the frame hidden,
  with ids of their own (`<view>:<id>`) and their images.
- `viewedRoot`: the desktop layer tree, after sections and stacks, takes each keyed layer's box
  and text style from the narrower read; layers whose element is not on that page are collapsed;
  unnamed layers move with their parent; wrappers take the union of their children; the root
  takes the page's width and runs as long as its content.
- `planOf` records which clip each layer became (`PlanItem.keys`, layer id → clip id); `withView`
  compares each layer's two boxes and writes: hidden, x/y/width/height, font size, line height,
  text resizing and wrap; a child of an auto layout leaves the flow (`layoutItem.absolute`). The
  breakpoint carries the view's own height (capped at the frame maximum).
- With breakpoints the page is not marked into components: an instance's layout can differ per
  copy on a phone, which per-composition overrides cannot say.

Values are stored in the base frame's units (x in view fractions, widths of children in base
units, ADR 0022), so `resolveView` draws the view at its own width and height.

Measured on the nine fidelity pages (SSIM fold/full, HTML, capture `v4`), tablet: vercel
0.69/0.89, linear 0.55/0.79, stripe 0.49/0.80, apple 0.93/0.71, framer 0.94/0.74, webflow
0.96/0.87, tailwind 0.94/0.94, blog 0.92/0.83, feega 0.84/0.87; phone: vercel 0.69/0.84, linear
0.28/0.68, stripe 0.53/0.55, apple 0.60/0.59, framer 0.82/0.75, webflow 0.80/0.74, tailwind
0.90/0.90, blog 0.87/0.41, feega 0.70/0.58. The base view keeps its fidelity (every page ≥ 0.95).
Breakpoints are opt-in for that reason.

## Resizing

Resizing an imported frame on the canvas (`fitToNode`, constrained) reflows it like the page in a
narrower window:

- A still frame keeps pixels on resize (`heldPixels`, the rule a breakpoint view uses): text size,
  stroke widths and the width of laid-out children stay, positions follow constraints and auto
  layout. Videos still scale with the frame.
- The page layer spanning the frame is pinned left and right (`pinnedWide`), so it fills the new
  width.
- A column whose content sits centred between equal side paddings (`centredColumn`,
  `page-stacks.ts`) loses those paddings; its full-width children fill it with `maxWidth` at their
  width (`RestNode.maxWidth` → `layoutItem.maxWidth`, never below the clip's own width), so the
  content stays centred on desktop and shrinks with a narrower frame.
- Paragraphs as wide as their column fill it and grow down (`STRETCHED`, `page-stacks.ts`).

`URL_IMPORT_RESIZE=<label> URL_IMPORT_CAPTURED=<capture> URL_IMPORT_ONLY=<pages>`
(`url-resize-fidelity.browser.test.ts`) resizes the plan to the widths the capture has
(`<page>@<width>-source.png`) and scores it against the page at that width.

Measured on capture `v4` (SSIM fold/full against the page at that width, before → after):

| page | 768 | 390 |
|---|---|---|
| vercel | 0.21/0.37 → 0.27/0.52 | 0.16/0.29 → 0.36/0.39 |
| linear | 0.45/0.50 → 0.53/0.62 | 0.45/0.35 → 0.83/0.36 |
| stripe | 0.43/0.37 → 0.38/0.36 | 0.57/0.49 → 0.62/0.56 |
| apple | 0.44/0.48 → 0.34/0.46 | 0.66/0.50 → 0.60/0.59 |
| framer | 0.68/0.40 → 0.52/0.39 | 0.70/0.40 → 0.58/0.30 |
| webflow | 0.68/0.46 → 0.60/0.43 | 0.55/0.46 → 0.49/0.42 |
| tailwind | 0.42/0.33 → 0.53/0.45 | 0.46/0.38 → 0.60/0.47 |
| blog | 0.62/0.55 → 0.77/0.59 | 0.56/0.41 → 0.70/0.56 |
| feega | 0.33/0.29 → 0.61/0.37 | 0.43/0.26 → 0.61/0.34 |

Before, a narrower frame was the desktop page shrunk (small text, same layout), which SSIM
sometimes scores well; after, text keeps its size and rows built with fixed widths (framer's
hero, apple's tiles, webflow's grids) run past the frame's edge.

## Not yet

- Breakpoint views where the narrower page uses other elements (linear's headline spans, stripe's
  logo marquee), pictures whose crop changes with the width, components together with
  breakpoints, phone pages taller than the frame maximum (16,384 px).
- Image and radial `mask-image`, filters and clip paths on blocks without text (they come in as
  snapshots); on blocks holding text only their own paint keeps the effect, the text does not.
- A blend mode passed to text leaves inside an isolated parent blends with less than the page did
  (stripe's hero: fold 0.989 → 0.974).

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
canvas. GPU text is drawn with `Smoothing.Plain` (`URL_IMPORT_GPU_SMOOTHING`), as the headless shell
renders the source and the HTML still; the canvas on a Mac dilates text like CoreText, which the
shell does not.
