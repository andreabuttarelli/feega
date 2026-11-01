# Poster templates draw whole on the GPU canvas

Inserting poster templates from the frame gallery left some frames blank or scrambled.
Two causes, both reproduced on dev against the test account (chromium and webkit,
35 still posters each).

1. **Source not saved yet.** `CoreFrames.load` fetched `/motion/<id>/source` once. Right
   after an insert the endpoint can answer 404 (node row saved, frame source not yet), and
   the frame key stayed in `asked`: blank until reload. Inserting the 37 poster templates
   400 ms apart left 1 to 5 frames blank on every run. `untilFound` retries a missing source
   (8 tries, 1 s apart), the same patience `fetchPickDoc` already had.
2. **SVG transform attribute in WebKit.** WebKit's computed `transform` for an SVG element
   is `none` even when the element has a `transform` attribute; Chromium folds it in. The
   reader placed every `<g transform>` / `<path transform>` at the origin: diagonal-pills lost
   its pills (mostly black), acid-strokes its strokes. The probe now reads the attribute when
   the computed value is unset and hands the reader a `matrix(...)` with origin `0 0`.

Regression: `tests/e2e/poster-templates-gpu.spec.ts` (`@real`, chromium + webkit) inserts every
still poster, waits for the GPU canvas to draw it, asserts no left-out clips (`data-partial`)
and compares the tile with its gallery preview (24×30 sample, mean drift < 9; broken posters
measured 10–90, good ones ≤ 7). Fails on diagonal-pills and acid-strokes without the probe fix.

Seen once and not reproduced again: recently inserted frames drawn black for a few seconds at
5% zoom while still loading. Not addressed here.
