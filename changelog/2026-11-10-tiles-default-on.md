# Tiled canvas on by default

The tile compositor (ADR 0034) is now the default. Off switch: `?coreTiles=0`, or
`localStorage['feega:coreTiles'] = '0'`; the URL wins. Revert the default with one constant,
`TILES_BY_DEFAULT` in `src/lib/canvas/core/tiles-switch.ts`. Tile memory follows the device
budget: 384 MB on desktop, 128 MB on phones and machines with ≤4 GB (`BUDGET.tileBytes`,
`WebCore::set_tile_budget`). The landings bench now passes `?coreTiles=0|1` explicitly and gained
an edit-latency case (move an element, time to first screen change, median of 5 steps).

Measured on landings before flipping (median, flag off vs on):
- CPU 1x, 3 runs: zoom 13→57 fps, fit 36→59, drag 51→58, drag-element 53→58, pan 59→59; time to
  sharp 1.9→1.4 s; edit latency 149→161 ms (screenshot polling floor ~140 ms: no measurable gap).
- CPU 4x, 3 runs: zoom 10→19 fps (p95 581→100 ms), fit 26→43, drag 10→21, drag-element 14→25,
  pan 43→54; time to sharp 3.5→2.1 s.
- Playwright WebKit, 1 run each: flag off failed the mid-fit blank check (the known flag-off
  defect); flag on passed: pan 56, zoom 19 (p95 83), fit 43, drag 47, drag-element 54 fps.
  Real Safari not run.

Not covered: typing latency, WebGL fallback (no tile path), mobile GPUs, real Safari.
