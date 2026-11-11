# Landing hero: animated ASCII field

The hero sat on flat black. It now has a canvas of glyphs from a density ramp, driven by
warped sine waves whose time input is a point on a circle, so a 24 s period loops with no jump.
Colour runs orange #ff5100 → peach → mauve → blue across columns, alpha 0.12–0.5; a CSS gradient
fades it to black at the bottom.

Performance: DPR ≤ 2, ≤ 12k cells, 30 fps, starts after `load`, pauses offscreen or hidden tab,
one static frame with reduced motion. Pure functions in `landing/src/lib/site/ascii-field.ts`
with tests. Discarded: Perlin noise lib (dependency), DOM text grid (layout cost).
