# Imported breakpoints are linked views of one tree

Audit `~/Documents/feega-videos/audit/round2/import/`: editing the desktop headline of an imported
vercel.com page did not reach tablet or phone. Each view was its own captured copy.

- **Before.** A desktop layer and a view layer paired only when their paint (text, fills,
  pictures) matched and their nearest keyed ancestors had paired. Repeated parts were components
  on desktop, their instances hidden in the views and the view's plain layers copied in. On
  vercel.com: 310 view-only copies at tablet, 16 desktop layers shown there.
- **Now.** Pairing is by element, kind and words; fills and pictures are the base's. The
  structural check accepts a counterpart anywhere inside the partner of the nearest paired
  ancestor, so a wrapper painted at one width only no longer splits the subtree. A keyed base
  layer with no counterpart shows when its children are linked. Pages imported with breakpoints
  skip component extraction: instance placement and per-instance overrides cannot vary per
  breakpoint.
- **Kept per view.** Stretched pictures (page rasters) pair only with the same raster: the hero
  triangle was squeezed into the phone box (vercel phone fold 0.989 → 0.917). Texts worded
  differently stay view-only: the stripe desktop sentence in the phone box ran over the buttons
  (stripe phone fold 0.982 → 0.743). Both measured, then excluded.
- vercel.com, v6 captures: 265 linked layers and 66 view-only at tablet (one text: a scrambling
  label). Fold/full unchanged or better on vercel, stripe, linear, feega (linear phone fold
  0.864 → 0.945).
- ADR 0022 amended. Tests in `page-views.test.ts`.
