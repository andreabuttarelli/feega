# URL import fidelity

Import from URL drew the first screen of a page roughly and lost most of the rest: text split
mid-line by links, system fonts instead of the page's, black SVG charts, missing scroll-revealed
sections, a 3 840 px height cap, auto layout that moved things. Goal: the frame looks like the
page, top to bottom. Spec `docs/specs/url-import.md`, ADR 0026.

## What changed

- Capture (`pagePrepared`, `page-reveal.ts`): every IntersectionObserver sees its targets from
  the first script; the page scrolls to the bottom and back; animations finish, videos stop on
  their last frame, cookie banners are hidden; then timers, rAF, `play()` and transitions are
  frozen so the tree and the snapshots read the same state.
- Walker (`page-tree.ts`, helpers in `page-kit.ts`, self-contained because they travel as text):
  inline formatting contexts become one TEXT with styled runs (one per line when lines do not
  share an edge); variable axes, OpenType features, `text-transform`, decorations; `::before` /
  `::after` materialized; exact SVG paths (arcs, `use`, symbols, gradients, `currentColor`),
  `<img src=*.svg>` inlined; gradients, cover/contain/positioned backgrounds, `object-fit`,
  borders per side, outline, inset shadows, blur and backdrop blur; paint order from
  `z-index`/stacking with fixed and z-indexed nodes lifted; clipping by overflow ancestors.
- Auto layout only when a simulation of the flex container puts every item where the browser
  did (±0.5 px) and no item spills; otherwise absolute.
- Video, canvas, iframe, masked/blended/rotated/tiled blocks: raster snapshot of the element alone
  (`page-snaps.ts`), up to 48.
- Fonts: the page's `@font-face` files (cross-origin fetched, latin subset preferred) are uploaded
  as org fonts; system/Arial/Times/Georgia/Courier stacks map to Inter/Arimo/Tinos/Gelasio/Cousine.
- Height: up to 65 536 px, stacked frames of 16 384 px.
- Harness: `URL_IMPORT_CAPTURE` / `URL_IMPORT_FIDELITY` on eight pages (`fidelity-pages.ts`), SSIM
  above the fold and over the whole page; `scripts/url-import/capture-fixture.ts` removed.

## SSIM (fold / full page), before → after

| page | fold | full |
|---|---|---|
| vercel | 0.711 → 0.979 | 0.450 → 0.971 |
| linear | 0.795 → 0.983 | 0.390 → 0.967 |
| stripe | 0.671 → 0.972 | 0.620 → 0.892 |
| apple (macbook air) | 0.561 → 0.987 | 0.820 → 0.940 |
| framer | 0.511 → 0.978 | 0.240 → 0.840 |
| webflow | 0.543 → 0.742 | 0.371 → 0.867 |
| tailwind docs | 0.791 → 0.952 | 0.817 → 0.957 |
| overreacted blog | 0.892 → 0.955 | 0.395 → 0.941 |

## Discarded

- Inferring auto layout and accepting small moves: every misdetection moved whole sections.
- Slices of 4 096 px: more frames, worse scores.

## Not yet

Tablet/phone breakpoints (ADR 0022); dashed strokes, masks and blend modes as layers (snapshots
today); Webflow's consent banner and carousel state; Framer's scroll-driven tabs.
