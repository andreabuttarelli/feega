# Never show a magnified tile (ADR 0039, steps 2–4)

During a wide zoom the canvas drew a coarser tile level stretched 2–8× while the right level baked, which looked blurry for 1.4–1.7 s per leg.

- `tiles.rs`: a cached tile is drawn only when stretched ≤ 1.25× (`sharp_at`). Visible tiles that nothing sharp covers are `TileFrame::bare`.
- `web.rs`: when tiles are bare, the engine renders the scene at native resolution in patches over the uncovered bands only (`fallback_bands`, `render_view`). It uses coarser detail floors (`lod::coarser`) and never starts a group raster. Patches are reused while they stay within the cap (`fallback_serves`). New tiles fade in over it in 120 ms (`fade_in`, tile `opacity` in the reprojector). Any damage drops it.
- The pyramid also bakes the levels a half octave finer and coarser than the one shown, when idle.
- Counters: `unsharp` now counts bare tiles that no fallback serves. `__gpuCanvas.tally` gains `magnified` (frames with a tile stretched past the cap) and `fallback` (renders, ms).
- Tried and reverted: rendering the fallback in budgeted blocks with the coarse tile beneath. At CPU 4x it brought back more blur than before.

Results are in ADR 0039. Blur, blank and magnified frames are gone and fps matches before, but the worst frame is 2–3× before (CPU 4x: 266–400 → ~775 ms), so this stays a draft.
