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
- Caps: 1 500 nodes, page height `MAX_SIDE` (3 840 px), text 2 000 chars per node, 60 images,
  20 s navigation, 4 imports per user per minute.
- Desktop width 1 280 px. Hidden, transparent and off-page elements are skipped.
- Frame named after the page title (host when there is none).

## DOM → doc

The page is serialized as a Figma REST-shaped tree, then the existing Figma importer builds the
doc.

| DOM | Tree | Doc |
|---|---|---|
| flex container, children at the gap it declares | FRAME + `layoutMode`, gap, padding, align | auto layout |
| flex with margins, grid, block | FRAME / GROUP, absolute children | fixed positions |
| text node | TEXT, font, size, weight, line height, colour; `HEIGHT` resize when it wraps | Text clip |
| background colour, `background-image: url()` (not tiled), border, radius, box-shadow | fills, strokes, corner radii, effects | Shape / frame fills, strokes, effects |
| `<img>` | RECTANGLE with IMAGE fill | Shape with image fill |
| inline `<svg>` | VECTOR per shape, sampled polyline | Shape path |

Fonts not in the Google Fonts catalogue fall back to Inter.

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
  (`instance-diff.ts`). Differences on any clip, nested groups included, become overrides (text, fills,
  geometry, auto layout, layout item); images that differ become per-instance image slots. A different
  layer count leaves the copy unlinked. An instance that draws its own layers links even when its size
  differs from the main.
- Rendering: an instance with overrides is laid out again after they apply (`instanceTracks`), overrides
  reach clips inside nested groups, a group's size in a flow is the size of what it shows (instances
  included), and a frame without auto layout inside a flow keeps its box as an invisible background.

## Not in the MVP

- Tablet/phone captures as breakpoint overrides (ADR 0022).
- Gradients, `object-fit`, text split mid-line by inline elements, pages taller than 3 840 px.
