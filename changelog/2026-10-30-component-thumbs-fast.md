# Components panel thumbnails: one raster, a persistent cache

**Cause.** Each thumbnail created a fresh core raster (new GL/GPU context) and rendered the
whole frame (1920×1080). Timings showed `draw` in ~2 ms and the first `createImageBitmap` at
1.2–1.8 s: the new context compiling shaders, the same at 192×50. Each tile also refetched its
frame source (~450 ms), serially. Nothing survived a reload.

**Fix.**
- `stillRaster` (`core-export.ts`): one raster reused for every thumbnail, disposed after 10 s idle.
- `framedDoc`: the crop is scaled into the tile on the host clip, so the render is tile-sized.
- Frame source fetched once per frame revision.
- IndexedDB cache (`feega-component-previews`), key frame+component+tile side, value
  revision + SHA-1 of the component slice + webp. Same revision: shown with no fetch. Other
  revision: old poster shown at once, rehashed; same hash keeps it, else redrawn in background.

Measured with `tests/e2e/components-thumbs-perf.spec.ts` (`THUMBS_PERF=1`), headless Chromium,
dev server, machine load 30+. Desktop, cold open:

| Mains (tiles) | First | All, before → after | Long tasks ms, before → after |
|---|---|---|---|
| 20 (40) | 4.3 → 2.9 s | 86 → 6.8 s | 65,272 → 1,906 |
| 50 (100) | 2.6 → 2.2 s | 195 → 5.1 s | 137,089 → 1,120 |
| 100 (200) | 2.5 → 2.5 s | 356 → 9.2 s | 256,981 → 1,186 |

Reopen after reload (after): all in 1.2 / 2.7 / 4.8 s, zero long tasks. Discarded: moving the
render to a worker (the GL context compile is the cost, one per batch is enough).
