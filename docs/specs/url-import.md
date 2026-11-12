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
  node, 200 images per read, 48 raster snapshots, 20 s navigation, 4 imports per user per minute.
- Desktop width 1 280 px. Hidden, transparent and off-page elements are skipped.
- Frame named after the page title (host when there is none).

## Capture

The page is read once, frozen, and the tree, the raster snapshots and the fidelity reference
screenshot all come from that same frozen state.

Every tab is pinned to light before the page loads (`fenced`, `browser.ts`): the
`prefers-color-scheme: light` media emulation, a `matchMedia` that answers light to any colour
scheme query (`lightOnly`, registered after anything else the browser injects — Browserless'
stealth fingerprint answered dark in 2 of 5 vercel.com reads), `:root{color-scheme:light}`, and the
`Sec-CH-Prefers-Color-Scheme: light` client hint for sites that pick the theme on the server.

`pagePrepared` (`import-url.ts`):

1. Before the first script (`tab.seeAll`): every IntersectionObserver reports its targets in view
   (`everythingInView`); `heldStill` makes every shadow root open, and gates rAF, scroll / resize /
   pointer / focus / visibility listeners, `matchMedia` listeners and ResizeObserver callbacks on
   `__feegaStill`, so nothing the page registered can move it once frozen.
2. The page settles, scrolls to the bottom in 700 px steps and back. The walk runs inside the page
   in one call (`inViewSampled` with a `Walk`), waiting a pause and a frame per step. At each step `inViewSampled`
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
the rest of the page is hidden. Each snapshot is one evaluate that stages it (previous canvas
swapped for its picture, snapshot style, scroll) and one viewport `page.screenshot`, cropped on the
server: a clip would cost one more round trip (puppeteer reads the viewport first), and a capture
on a second CDP session left apple.com missing images in every later screenshot. A second session
only switches the transparent background, when the mode changes.

## Time

Over Browserless every call to the page is a network round trip (~180 ms measured from Europe to `production-sfo`) and the
session ends at 120 s (`BROWSERLESS_SESSION_MS`), so the capture keeps calls few and waits on
events, not fixed times:

- From the first script (`drawnInView`), a WebGL canvas that a native IntersectionObserver
  reports out of view draws one frame a second (from a `clear`) instead of every frame. Every observer is told
  its targets are in view, so otherwise every scene draws, and Browserless draws WebGL in
  software: on stripe.com the main thread stalled 30-40 s.
- `goto` waits for `load`, then, like `settle`, for a quiet network: nothing started or ended for
  500 ms and nothing in flight younger than 4 s. Requests puppeteer never sees end (workers,
  out-of-process iframes: stripe.com has three) do not hold it.
- `tab.left()` is the time the session has left (unbounded locally). Snapshots stop 5 s before the
  end and keep the pictures taken; the nodes without one are dropped.
- A read that comes back unreadable with no time left answers `too_slow` (504) at once. Only an
  unreadable read with time left (a crashed renderer) is read again, with the native
  IntersectionObserver.

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

## Layers

`page-flatten.ts` drops what draws nothing and changes no layout (rule tables `CHILD_RULES`,
`PARENT_RULES`), then names what is left. `url-layers.browser.test.ts` is the guard: the same captures
planned before and after a change must paint the same pixels (images replaced by solid colours, every
breakpoint view, the frame resized to 768 and 390), else the rule stays out.

- Names, in order: component name; tag or ARIA role (`Nav`, `Header`, `Button`, `Link`, `Item`…, a
  section by its first words); `id` or `aria-label` unless generated (`__next`, `:r3:`); class word
  (`Card`, `Badge`); `Icon` / `Image`; `Row` / `Column`; `Frame`. A text's words name only the text:
  a block holding one text is not named after it.
- Code import: a wrapper whose own `source` differs from the survivor's is never folded, grown or
  merged into it (its padding, gap or layout would be written back to the wrong element); a survivor
  without a `source` inherits the wrapper's. Unwrapping a wrapper that adds nothing stays allowed.
- Kept, each proven by the guard: a text boxed for a stack (as a flow item the engine sets it up to
  1 px off), a clipping svg frame in a narrower wrapper (its clip shaves the stroke edges), the
  original layers of instances whose flattened shapes diverge.

## Sections

On by default (`sections: false` / `--no-sections` / the dialog checkbox turn it off), and off with
breakpoints (see Breakpoints). The page frame's direct children become section frames in a vertical
auto layout, top to bottom.

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

`repeatedOf` (`src/lib/server/url-import/repeated.ts`) runs on the tree before `restMessage`; what a
block is comes from one table, `KINDS` in `component-kinds.ts` (first matching row wins).

- The walker keeps per node `dom`: `tag`, `role`, a component word from the class (`hint`, from
  `HINT_WORDS`: `Button_root` → `button`), the `landmark` it sits in (footer, nav, header) and `press`:
  the control (link, button, tab, menuitem) whose text is exactly this node's text.
- Skeleton signature: kind, type, auto layout direction, text size/weight, image fill presence,
  recursively; text, image src and colours ignored.
- Candidate: inside the page horizontally (an off-page carousel slide made a main whose copies drew
  shifted), FRAME/GROUP, ≥2 nodes, ≥16 px per side, painted or with image/icon, or an atom kind, or a
  kind that stands alone; a text or picture leaf when its kind allows it (nav, footer and plain links,
  avatars, named logos), wrapped in an instance frame of its own box.
- Kept when ≥2 copies of one look, or when the kind stands alone: buttons, badges, inputs, avatars, tabs,
  nav and footer links, named logos, accordion items, pricing tiers (a price per period), testimonials,
  footer columns, and cards or feature tiles that are boxed (painted with a radius, bordered or with a
  shadow).
- Same skeleton → one group; look → variant: atoms by filled/outlined/plain, fill and stroke colour,
  pill; molecules by their exact fills, strokes, radius, effects and opacity;
  sized kinds also split by height (within 15 %). Size is otherwise not part of the key: a copy of
  another size is an instance with a size override.
- Sets: atoms merge by name (one Button set); molecules merge when their leaves are alike (Jaccard ≥ 0.5,
  size within 1.6×/2×) or when they are siblings in one grid with the same look. Variant properties come
  from the kind's `props`: `Style` (Primary/Secondary/Tertiary by saturation then use, Outline, Plain),
  `Size` (Small…Large, XS…XL), `Icon` (Leading, Trailing, Only, None), `Image` (On/Off), `Items` (text
  count); `Variant=<label>` (node name, single text, image alt or file name) or `Variant=N` only when
  those collide. Two sets of one name are qualified by their section, then their label
  (`Hero Card`), before `Card 2`; `kindNamed` reads the kind from the last words of a name.
- Nesting: outer first. Atoms nest in molecules (a Button instance inside the Card main), not in atoms;
  molecules nest when painted (or paintless kinds: list items, accordion items, footer columns); icons
  and generic items never nest; a block with its parent's box is not a second component.
- Occurrences become `INSTANCE` nodes whose `componentId` is the first copy; that copy is the main, placed
  where it was. A main nested in another set's main is homed on its own set frame (`setHomes`).
- Set frames get a `Background` rect (`SET_BACKDROP`, which `setMainOf` accepts): the most used
  backdrop of their mains, found by `main-backdrop.ts` walking up from the clip that places the main
  (through the comps that hold it) to the first opaque solid fill, with its variable binding; a main
  on another backdrop gets its own rect behind it, its box plus half the set gap.
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

By default (`breakpoints: false` / `--no-breakpoints` / the dialog checkbox turn it off) the page is
read again at 768 and 390 px (`PAGE_VIEWS`, `tab.viewport`), each with the same freeze, in its
own tab at the same time as the desktop read; a width whose tab cannot open is left out. The
frame gets Tablet and Phone breakpoints (ADR 0022, amendment 2) that draw the page as it is at each
width:

- The walker names every layer by where it sits in the DOM (`RestNode.key`: element path, `~n`
  for the n-th text run of an element, `.i` for a line). Keys match across widths.
- `joinedTree`: a paragraph the walker split into lines comes in as one wrapping text (alignment
  read from the line edges), on every read, so it can be the same layer at every width. Only a run
  that is its element's only run is joined; lines of a run that starts after an inline chip stay
  where the page put them.
- Each narrower read is shaped like the desktop one (stacks, flatten; no sections, components or
  interactive parts) and planned on its own at the base frame's units per pixel (`planOf(…, unitsPerPx)`, `sliceItems`). A page taller
  than one frame cuts each narrow read where the desktop cut falls (`narrowCuts`).
- `withViews` (`page-views.ts`) merges each view plan into the base doc, widest first, against the
  doc as resolved at that view:
  - a base clip and a view clip with the same key are one layer when they differ only in layout
    keys (`LAYOUT_PROPS`: box, font size, line height, letter spacing, font axes, alignment, text
    resizing and wrap, outline) and pictures; matching runs top down, so a layer pairs only under a
    paired parent. Its view values are lifted into overrides (`liftEdit`); in an auto layout it
    leaves the flow at its captured box with fixed sizing; it takes the view read's visibility.
  - a layer pairs only when its nearest named ancestor paired with the view layer's nearest named
    ancestor, so a shared layer is drawn inside the box the view puts it in.
  - unnamed wrappers (stacks) span their paired children; the page root spans the view.
  - every other view clip comes in as a view-only layer (`<view>:<id>`), its subtree,
    compositions and pictures with it, hidden at base, shown in its view, placed below the next
    paired clip of the view's paint order. Base clips with no partner are hidden there.
  - the breakpoint is as wide and as tall as the view plan; its height may exceed the frame
    maximum.
- Each read brings up to 200 pictures of its own.
- With breakpoints the page is not split into section frames: a section cuts a block spanning two
  of them into pieces named after one element, which no view can match. Components and interactive
  parts stay on the desktop; an instance has no plain partner in a narrow read, so the views draw
  the narrow read's own layers there.

Values are stored in the base frame's units (ADR 0022), so `resolveView` draws the view at its
own width and height; the canvas sizes a view by the frame's pixels per unit, and so do both
fidelity harnesses.

Measured with the HTML still (SSIM fold/full against the page at that width; capture `v4`, supabase
and astro from `v6`; before = the first cut on the same capture):

| page | desktop | tablet before | tablet after | phone before | phone after |
|---|---|---|---|---|---|
| vercel | 0.99/0.96 → 0.99/0.96 | 0.67/0.89 | 0.92/0.93 | 0.69/0.85 | 0.98/0.94 |
| linear | 0.97/0.96 → 0.98/0.97 | 0.84/0.87 | 0.98/0.97 | 0.62/0.81 | 0.97/0.97 |
| stripe | 0.99/0.98 → 0.99/0.98 | 0.49/0.83 | 0.98/0.97 | 0.53/0.57 | 0.98/0.95 |
| apple | 0.99/0.97 → 0.99/0.97 | 0.94/0.71 | 0.99/0.97 | 0.62/0.58 | 0.98/0.96 |
| framer | 0.99/0.96 → 0.99/0.96 | 0.93/0.74 | 0.98/0.98 | 0.82/0.75 | 0.91/0.95 |
| webflow | 0.99/0.96 → 0.99/0.96 | 0.95/0.92 | 0.99/0.94 | 0.80/0.76 | 0.90/0.94 |
| tailwind | 0.95/0.95 → 0.95/0.95 | 0.94/0.95 | 0.97/0.97 | 0.90/0.91 | 0.97/0.95 |
| blog | 0.98/0.97 → 0.98/0.97 | 0.92/0.83 | 0.94/0.92 | 0.88/0.41 | 0.92/0.86 |
| feega | 0.96/0.95 → 0.96/0.95 | 0.84/0.86 | 0.96/0.98 | 0.70/0.58 | 0.82/0.91 |
| supabase | 0.94/0.94 → 0.94/0.94 | 0.90/0.84 | 0.92/0.93 | 0.70/0.78 | 0.79/0.86 |
| astro | 0.90/0.93 → 0.90/0.93 | 0.77/0.82 | 0.81/0.83 | 0.57/0.64 | 0.66/0.68 |

The same frames drawn by the GPU core (`gpu-fidelity.ts`, WebGPU):

| page | desktop | tablet before | tablet after | phone before | phone after |
|---|---|---|---|---|---|
| vercel | 0.99/0.97 → 0.99/0.97 | 0.69/0.89 | 0.93/0.97 | 0.70/0.85 | 0.99/0.98 |
| linear | 0.97/0.97 → 0.99/0.97 | 0.84/0.87 | 0.99/0.97 | 0.63/0.81 | 0.95/0.97 |
| stripe | 0.98/0.97 → 0.98/0.97 | 0.47/0.82 | 0.92/0.96 | 0.53/0.57 | 0.99/0.95 |
| apple | 0.99/0.98 → 0.99/0.98 | 0.95/0.71 | 0.99/0.97 | 0.64/0.58 | 0.99/0.94 |
| framer | 0.99/0.96 → 0.99/0.96 | 0.94/0.74 | 0.99/0.98 | 0.82/0.75 | 0.91/0.95 |
| webflow | 0.99/0.96 → 0.99/0.96 | 0.95/0.92 | 0.98/0.95 | 0.80/0.76 | 0.90/0.94 |
| tailwind | 0.96/0.96 → 0.96/0.96 | 0.95/0.96 | 0.98/0.98 | 0.90/0.91 | 0.97/0.96 |
| blog | 0.97/0.97 → 0.97/0.97 | 0.93/0.84 | 0.95/0.93 | 0.90/0.42 | 0.92/0.87 |
| feega | 0.95/0.96 → 0.95/0.95 | 0.83/0.86 | 0.96/0.98 | 0.69/0.59 | 0.82/0.92 |
| supabase | 0.98/0.95 → 0.98/0.95 | 0.94/0.85 | 0.97/0.94 | 0.79/0.80 | 0.88/0.89 |
| astro | 0.90/0.93 → 0.90/0.93 | 0.77/0.82 | 0.81/0.84 | 0.57/0.64 | 0.65/0.68 |

Below 0.95 the causes are the narrow page as the planner draws it at any width, not the merge: the
same reads planned alone as pages score alike (feega phone fold 0.84, framer phone 0.91, webflow
phone 0.90, blog phone 0.91/0.87). Fonts render a hair heavier and wider than the page (feega's
serif headline, supabase's Inter at weight 450), so lines wrap one word early (blog, framer);
blurs wider than the effect's cap come in brighter (vercel's card glow); scroll-revealed blocks
caught mid-fade in the screenshot (webflow); astro's desktop is below 0.95 too.

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

## Interactive parts

`page-patterns.ts` is one in-page table: each row says how to find a part (`<details>`; `[aria-expanded]` with the panel it controls; `[role=tablist]` with its panels; `[role=switch]` and checkboxes; Swiper carousels), its states, how to enter one and which elements lead to which state. The walker (`pageTreeOf`) stamps each part's root (`pattern`) and the elements that lead to another state (`go`), reads the page as it is, then for every other state unfreezes the page for a beat (`__feegaStill` off, a timer rAF), enters it with link navigation blocked, drops focus and reads the root again (`tree.patterns`). A state the page does not take (`shows` false) is skipped, and a part with no other state left loses its marks. Parts nested in a part, rooted at the body, or larger than half the page are left out.

`page-hovers.ts` reads every `:hover` rule whose hover is on the subject (not `.card:hover .title`), applies it through an attribute selector with transitions off, and stamps the changed look and the element's own transition on its node (`hover`). `hover-states.ts` turns that into a Hover element state: fill (background, or colour on a text), stroke, opacity, scale; the CSS timing function becomes a house ease or a bezier.

`pattern-sets.ts` runs at the marker step of `urlPlan`: part roots are set aside so `repeated.ts` does not fold look-alike parts into one main (a repeated block around one is unmarked), then each root becomes the main of its own set (`Accordion 1 / State=Closed`), the other states are inserted beside it as hidden absolute mains so the Figma path builds them, and every `go` becomes a `change_to` link (ADR 0030, amendment). After planning the hidden placements of the other variants are removed; their comps stay in the page doc and go to the Components frame with the set. With breakpoints on, parts stay plain.

The player swaps the instance around a clicked layer (`variant-change.ts`): spots are placed by the precomp path down to the layer (`pathRect`), so each instance of a main has its own.

## Not yet

- Breakpoint views keep the desktop paint order for the layers they share with it; a view only
  changes the order of its own layers. Section frames together with breakpoints.
- Image and radial `mask-image`, filters and clip paths on blocks without text (they come in as
  snapshots); on blocks holding text only their own paint keeps the effect, the text does not.
- A blend mode passed to text leaves inside an isolated parent blends with less than the page did
  (stripe's hero: fold 0.989 → 0.974).
- Interactive parts driven by pointer events or by scripts the freeze stops (feega.app's tabs are a Framer component that ignores a synthetic click once frozen), JavaScript hover effects, hover on a descendant (`.card:hover .title`), carousels other than Swiper, interactive parts on the tablet and phone views (they come in as plain layers there).

## Fidelity

`URL_IMPORT_CAPTURE=<label>` (`url-capture.browser.test.ts`) captures the pages in
`fidelity-pages.ts` as the import reads them, plus a reference screenshot;
`URL_IMPORT_FIDELITY=<label>` (`url-fidelity.browser.test.ts`) draws the plan and scores SSIM above
the fold and over the whole page. Output in `~/Documents/feega-videos/url-import/fidelity2/`.
`URL_IMPORT_SHEET=<label>` (`components-page.browser.test.ts`, with `URL_IMPORT_CAPTURED`) draws
every set frame of the plan where the Components page puts it, on the light canvas grey, as
`runs/<label>/<page>-components.png`.

The HTML still is not what the canvas draws. `URL_IMPORT_GPU=<label> npx vite-node --config
scripts/vite-node.config.ts scripts/url-import/gpu-fidelity.ts` (optional `URL_IMPORT_CAPTURED`,
`URL_IMPORT_ONLY`, `URL_IMPORT_GPU_BACKEND=webgl`, `URL_IMPORT_GPU_HEADED=1`) puts the same plan
frames in a GPU core world as `CoreFrames.svelte` does, screenshots the canvas band by band and
writes `<page>-gpu-*.png`, `<page>-gpu-score.json` and a `gpu-<backend>.md` table next to the
HTML scores of the same label. Both harnesses stretch each frame into its node box, like the
canvas. GPU text is drawn with `Smoothing.Plain` (`URL_IMPORT_GPU_SMOOTHING`), as the headless shell
renders the source and the HTML still; the canvas on a Mac dilates text like CoreText, which the
shell does not. Captured views (`<page>@768`, `<page>@390`) are planned with the page and scored too,
each frame resolved to the view (`resolveView`) and sized by the frame's pixels per unit, as the
canvas sizes a view. `URL_IMPORT_SHAPE=full` plans with sections and tokens as the product does;
the default is the plain shape. A capture reads the tree and screenshots the page a moment apart,
so a page that moves on its own between the two (stripe.com's rotating accordion, apple.com's
search panel on narrow widths) scores low for both old and new code: compare code on one capture.
