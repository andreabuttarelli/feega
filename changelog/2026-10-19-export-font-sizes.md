# Export draws fractional font sizes

html-to-image's `cloneCSSStyle` rewrote every computed `font-size` in px
to `floor(size) - 0.1` (Chrome path, where computed `cssText` is empty).
A 79.92 px header was drawn at 78.9 px: exported posters and videos were
narrower than the live player (iso-blocks poster, export vs live DOM:
SSIM 0.904).

The rounding is removed in `patches/html-to-image+1.11.13.patch` (dist,
es and lib builds). Same poster after: SSIM 1.0000, pixel-identical.

Discarded: scaling the capture (still floors, at a different size) and
overriding `getComputedStyle` around the capture (global hack).

Guard: `src/lib/motion/hyperframes/screenshot-font.test.ts` runs the
hosted bundle and fails if a fractional size is rounded again.
`bench:gpu-parity` accepts `--under=html` to compare the export capture
with `--ref=live`.
