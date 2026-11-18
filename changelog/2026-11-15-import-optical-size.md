# Optical size on imported text (traidue.com round 3)

traidue self-hosts an Inter with only a `wght` axis, so the browser draws every
size in one design. The import lands on Google Inter, which has `opsz`, and the
canvas set `opsz` to the type size: large titles drew in the narrower display
cut. `page-tree.ts` now probes whether the page font reacts to `opsz`; when it
does not, it asks for `'opsz' 0`, and `fonts.ts` clamps requested axis values
into the font's range, so 0 lands on the text cut.

Measurement findings from the same round (check harness, not code):
- Most pages' 0.01–0.02 drop against 0.1.32 was the canvas shot sitting 1–2 px
  off the reference (pan rounding in `shoot-canvas.cjs`). `compare-aligned.cjs`
  searches ±4 px before SSIM.
- The reference shots had a hovered card (the pointer stayed where the cookie
  button was); the site shooter now moves the pointer away.
- `freeze-random.mjs` now keys `Math.random` streams by call site, so module
  warm-up calls no longer shift the shuffles between the two dev servers.
