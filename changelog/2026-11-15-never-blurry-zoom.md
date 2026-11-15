# Never show a magnified tile (ADR 0039, steps 2–4)

During a wide zoom the canvas drew a coarser tile level stretched 2–8× while the right level baked, which looked blurry for 1.4–1.7 s per leg.

- `tiles.rs`: a cached tile is drawn only when stretched ≤ 1.25× (`sharp_at`). Visible tiles that nothing sharp covers are `TileFrame::bare`.
- `web.rs`: when tiles are bare, the engine renders the scene at native resolution in patches over the uncovered bands only (`fallback_bands`, `render_view`). It uses coarser detail floors (`lod::coarser`, `lod::Floors`: text ×3, effects ×10) and never starts a group raster. A profile showed effect layers dominating fallback cost, not planning or encoding. Patches are reused while they stay within the cap (`fallback_serves`). New tiles fade in over it in 120 ms (`fade_in`, tile `opacity` in the reprojector). Any damage drops it.
- The pyramid also bakes the levels a half octave finer and coarser than the one shown, when idle.
- Counters: `unsharp` now counts bare tiles that no fallback serves. `__gpuCanvas.tally` gains `magnified` (frames with a tile stretched past the cap) and `fallback` (renders, ms).
- While zooming in, the next fallback (1.25× closer, `ahead_camera`) renders in 6 ms blocks while the current one still serves.
- Tried and reverted: rendering the fallback in budgeted blocks with the coarse tile beneath, which brought back blur at CPU 4x. Also reverted: drawing every fallback effect plain plus an adaptive 6–24 ms render-ahead budget. Neither got the CPU 4x worst frame under 450 ms, and desktop got noisier.

Results are in ADR 0039. Blur, blank and magnified frames are gone and fps matches before. The desktop worst frame is 67–69 ms (before 51–67). The CPU 4x worst frame is 467–500 ms (before 266–400), so this stays a draft.
