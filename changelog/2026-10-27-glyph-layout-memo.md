# Memoize glyph layout on the core canvas

Card text was laid out again every time a card was redrawn. `glyphsOf` now keeps up to 2000 laid-out strings per face, keyed by text, size and options. Output is identical.

A translation-invariant layer-body cache in gpu-core was tried and measured on the heavy canvas: no gain at x4 (panZoomed p5 29 to 20 fps, within noise or worse). Dropped; numbers in `scripts/perf/results/2026-10-27-core-layer-cache.md`.
