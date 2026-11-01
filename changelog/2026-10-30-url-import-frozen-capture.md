# URL import reads one frozen page

After PRs #1618/#1619 five of the eight fidelity pages were under 0.95 SSIM: webflow 0.742 /
0.867 (a cookie banner and a ticker in the reference, not in the import), framer 0.840
(scroll-driven tabs and fades), stripe 0.892, apple 0.940, blog 0.941. Part of it was the
comparison: the tree and the reference screenshot came from two different states of a page that
kept moving. Part was the import.

## What changed

Capture (`page-reveal.ts`, `import-url.ts`, `web/browser.ts`):

- `heldStill`, installed before the first script: shadow roots are always open; rAF, environment
  listeners (scroll, resize, pointer, focus, visibility), `matchMedia` listeners and
  ResizeObserver callbacks stop when the page is frozen. `captureBeyondViewport` flips
  `orientation` and resizes the viewport; Framer re-rendered whole sections on it.
- `inViewSampled` at every scroll step records each animated or inline-styled element at its most
  visible in-view state; two samples at the top mark restless ones (tickers). `RevealMode.Still`
  pins the rest with inline `!important` values.
- Infinite animations and GSAP loops at their start, carousels on the first slide.
- Cookie banners: also under `<html>`, in shadow roots, rendered late (MutationObserver on the
  document and every shadow root).
- Canvases, videos and iframes are replaced by their own snapshot once read; snapshots see
  `clipPath`/`mask` sources (webflow's footer logo came out empty).

Walker and doc:

- SVG `clip-path` to one unrotated `rect` becomes a clipping frame, not a snapshot (stripe had 46
  such icons and ran out of the 48 snapshots before its carousel canvas).
- Text box width halfway between the widest line and where the next word would fit; blank lines
  counted in the line pitch (apple footnotes were a third taller).
- Inline chips keep their side room as letter spacing on the letters around them, and their
  borders (blog). Figma style overrides carry `letterSpacing` to run `tracking`.
- A picture cut on both sides keeps the part that was showing (apple hero).
- Auto layout frames applied their opacity to children twice (also affects Figma imports).

Collapsed content (user report on feega.app: every FAQ answer drawn over the next question):

- The content of a closed `<details>` is read as layers marked `collapsed` (RestNode → raw node →
  scene `hidden` → clip `hidden: true`): not painted, kept in the frame to show later. Figma
  layers with `visible: false` are still left out, as before.
- Content under a zero height or zero max-height clip, a `0fr` grid row, `hidden`,
  `visibility: hidden` or `aria-hidden` collapse is not painted (browser test).
- feega.app joined the fidelity pages; the capture test fails when the text of a closed
  `<details>` is painted.

## SSIM (fold / full), HTML still, fresh captures on dev b74b667c4

| page | dev | after |
|---|---|---|
| vercel | 0.979 / 0.970 | 0.996 / 0.972 |
| linear | 0.989 / 0.971 | 0.989 / 0.979 |
| stripe | 0.981 / 0.900 | 0.981 / 0.928 |
| apple | 0.987 / 0.936 | 0.991 / 0.969 |
| framer | 0.987 / 0.861 | 0.986 / 0.970 |
| webflow | 0.736 / 0.844 | 0.989 / 0.957 |
| tailwind | 0.951 / 0.944 | 0.951 / 0.942 |
| blog | 0.974 / 0.951 | 0.974 / 0.962 |
| feega | 0.958 / 0.906 | 0.957 / 0.961 |

Stripe and tailwind full lose on lists and a button that the auto layout pass stacks with the
wrong gaps and size; not this change.

Fonts of cross-origin stylesheets: a reader of network responses was dropped in the rebase, dev's
`sheetFonts` (server fetch) covers it.

## Discarded

- Rendering the plan at page pixel density (scale 0.5) for scoring: no gain, blog and linear
  lower.
- Picking the first fully visible sample: Framer cards were caught halfway through their fade.
- Inserting hair spaces for chip padding: invisible characters in editable text.
