# Heavy canvases: effect passes stop blocking the page while zooming

**Measured on a copy of a real heavy canvas** (56 frames, ~4.5k items, a few hundred effects;
fit-all view, 1440×900 at DPR 2), Playwright, `tests/e2e/canvas-heavy-copy-probe.spec.ts`:
every zoom step was a full raster, `queue.submit` took 41% of main-thread time (1.9 s in a 4 s
zoom), each session created 11–16k textures and the WebKit GPU process peaked at 760–850 MB.

**Causes and changes:**
- Every effect pass submitted its own command buffer. `FilterPasses` now records passes into one
  encoder, flushed before the next render reads them; buffers and evicted pool textures are
  released after the flush. Main-thread `submit` fell to ~10 ms in the same zoom.
- The effect pool got an eighth of the budget left after six screen textures: 11 MB on a retina
  desktop, below one screen-sized layer, so every pass created a texture. `POOL_SHARE` 8 → 3.
  Textures created per session roughly halved.
- The retained layer judged a full raster by CPU encode time, which returns before the GPU runs,
  so slow scenes looked cheap. The web core now times submit → done for sharp full rasters and
  `Retained` uses the larger of the two.

**Not solved:** after these changes zoom in the overview is GPU-bound, not main-thread-bound: a
full raster of this scene still costs ~200–450 ms on the GPU, and the `stretch` (past √2) and
`uncovered` rules still force one at every rung. Runs vary ±30%.

**Discarded experiments** (no measurable change on this canvas): dropping every blur, turning off
the zoom-time group cache, a coarser LOD ladder.
