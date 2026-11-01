# Imports: instances in auto layout land where the page put them

Code import scored below a plain URL import of the same capture (svgl `/` 0.705 vs 0.942, HeroUI
Badge 0.81 vs 0.96): cards, boundaries and badges inside auto layout flows came in shifted.

## Why

An instance in a flow is a precomp; layout places it by the bounds of what its component draws.
A component's layers were built as siblings of its frame background, so anything drawn outside
the frame (a badge hanging over the edge, an SVG whose paths sit outside its box) widened those
bounds and pushed the whole instance by the overflow. svgl's grid moved 226 px right and 243 px
down because two logos' captured paths sit near the page origin.

## What changed

- A component main and the layers an instance is diffed with now hold their children under the
  frame background, like a frame in a flow already did (`figma-doc.ts` `holds`). The comp has one
  root, the frame's box, so layout places the instance by its box.
- An instance's own layers start nested components as throwaway mains instead of linking them
  to the real ones (`ownOverrides`, `mains: new Map()`). Linking rebuilt the subtree at every
  level, and again when the link failed: 49k ids for 14 nested levels, 128 now. Nested
  instances inside own layers were also placed with the shift applied twice.
- An instance's picture override carries fit and focus, not only the image (`instance-diff.ts`):
  copies cropping the same picture differently drew the main's crop. More instances link with
  the change above, which surfaced it on apple (laptop slid right) and framer (logos stretched).

## Measured (SSIM fold/full, code vs plain URL import of the same capture `r4`)

svgl `/` 0.705 → 0.941 (plain 0.942); Next playground `/layouts` 0.948 → 0.994 (0.994),
`/context` 0.904/0.899 → 0.988/0.991 (0.988/0.991); HeroUI Badge 0.813 → 0.964 (0.964); other
pages unchanged. URL harness (`v4`, 9 pages) no page lower; webflow full 0.960 → 0.967.
