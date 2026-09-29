# Zoom-aware preview images on the canvas

Before: every canvas image loaded the original file. A 2000px image decodes
to ~16 MB; ~20 of them pushed iPhone Safari past its memory limit (PR #23).

Now:

- `/p/:p/c/:c/assets/:id?size=` takes a tier (`256|512|1024|2048|thumb`);
  the route signs image assets with the matching `canvas*` preset
  (`media-thumbnails.ts`, one table, `contain`, q75). Videos and `full`
  get the original. URLs carry no token, so `snapshot-keep` sees the same
  asset across refetches.
- `image-tiers.ts` picks the tier: CSS width x zoom x DPR, snapped up.
  Off-screen (or hidden behind a panel) nodes get 256. Downgrades wait
  for a two-step drop (hysteresis). Above a decoded-pixel budget
  (24 Mpx touch, 120 Mpx desktop) visible tiles step down together.
- `CanvasImageTiers` (inside SvelteFlow) replans 250 ms after the
  viewport settles; `TieredImage` keeps the old tier until the new one
  has `decode()`d.
- Fixed previews: list/reference thumbs (`thumb`), effects/composition
  previews (1024), influencer covers (512), share viewer (1024/512).
- Originals stay for downloads, editors and generation inputs.

Discarded: IntersectionObserver per tile (the viewport and node rects
are already known); swapping only at a zoom threshold (no memory relief
when zoomed out).

Measured (dev server, 40 × 2000px JPEGs, 20 far off-screen): decoded
image area 160 Mpx → 2.6 Mpx at overview in Chrome; WebKit iPhone 13
48 → 5.6 Mpx at zoom 0.46, 56 → 6.6 Mpx at zoom 2. At zoom 2 visible
tiles get ≥ the needed tier (2048 or original).
