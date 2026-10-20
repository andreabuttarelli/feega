# gpu-core draws text natively through gpu-text

A display list can now carry text as glyph runs instead of outlines:
`{ kind: 'glyphs', clip, font, coords, size, glyphs: [[glyph, x, y], …], paint, …look }`. The
native core outlines them with `packages/gpu-text` (skrifa, variable-font coords) at the run's
size and baseline, flattened at 0.05 device px, then draws them like any path — no JS, no
browser. Fonts are registered once (`Renderer::put_font`); a run in a font never registered is
reported as `<font> font`. Groups are outlined when put, not on every draw.

Boundary kept as agreed with the text work: in the browser the core still receives text as
outlines from the TS painter, so `gpu-text` is a native-only dependency (wasm stays 3.30 MB; with
it, it would be 4.94 MB).
