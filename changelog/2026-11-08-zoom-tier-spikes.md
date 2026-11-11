# Crossing the asset tier while zooming no longer redraws every card

The worst zoom frames on the heavy canvas (Chromium 4x CPU) were not an octave boundary alone:
`tier = assetTier(view.zoom)` flips at zoom 0.75, and `cardBases` read it, so each crossing re-ran
`faceOf`/`genViewFor` for every node. Image faces changed URL, `cardsOnCanvas` kept one body per
card, so the old body (and its per-reach `shiftDown` cache) was thrown away and rebuilt on every
flip back.

Now:
- `nearBases` and `farBases` are two memoized deriveds; `cardBases` picks one by tier, and the
  other is warmed in idle time, so a crossing reuses faces computed before.
- `cardsOnCanvas` keeps the last two bodies per card, so a tier flip and back reuses the moved body.
- `gpu-core` `Engine::draw` and `Gpu::paint` reuse Vello `Scene`s from a pool instead of allocating
  them per draw (`dlmalloc` free/insert showed in the long frames).

Probe, median of 3 runs (`r3-before-*` / `r3-after-*`): Chromium 4x zoom fps 39→48, p95
64.7→34.7 ms, CPU 2492→2188 ms; desktop CPU 827→767 ms. Worst frame at 4x ~133→~100 ms; one run
per batch still has a ~1.5 s frame (present before too, not fixed). WebKit is noisy (p95 41→45,
worst 77→123 median, runs 76–250 ms): not shown to be a regression from this change, not improved.
Settled screenshots 0.000% different.
