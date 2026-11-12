# Filters that do nothing are no filter at all

On the heavy canvas copy 101 of 174 filtered paths carried `blur(0px)`. Each one cost an offscreen
layer, filter passes, and a body-cache key that missed on every pan, for identical pixels.

`cssFunctions` (`packages/motion-core/src/motion/gpu-full/filters.ts`) now drops every function
whose identity is declared in one table, `NO_OP`: `blur(0)`, a `drop-shadow` with a transparent
colour, `opacity(≥1)`, `brightness/contrast/saturate(1)`, `grayscale/sepia/invert(0)`,
`hue-rotate(0)`. A chain keeps its live parts. Both producers (`dom/read.ts` and the effect path in
`display-list.ts`) emit no `filters` when nothing is left, so neither the display list nor the
engine sees them. A DOM filter left empty draws its items as they are instead of reporting a gap.

Disabled effects were already skipped; zero-strength ones now render to no-op functions and vanish.
SVG filters are untouched. `tests/effects.rs` checks the engine output is byte-identical with and
without each no-op, so dropping them is safe.
