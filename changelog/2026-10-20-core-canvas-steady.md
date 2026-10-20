# Core canvas: no empty cards on rebuild, rough zoom-out, boundary

Built on #990 (retained screen), rebased on dev.

- A card whose `cardKey` changes (content, thumbnail tier) fell to grey blocks until the new list
  was ready. `lastShown` keeps the last real group for ids whose new version is still being built;
  ids not rebuilding are forgotten so evicted textures stay evicted.
- A zoom-out that uncovers the retained texture mid-gesture rasters `Rough` (half scale); the sharp
  refine comes after `ZOOM_IDLE_MS`. Before, every such frame was a sharp full raster (~25 per
  gesture on the heavy canvas, p95 50 ms).
- `SentOverlay.changed` returns on the same array reference without serialising.
- `onready` no longer assigns an equal set to `coreDrawn`, and `CoreFrames` sits in a
  `svelte:boundary` whose error handler is `coreOff`: an `effect_update_depth_exceeded` (not
  reproduced here, only reported) leaves the classic canvas instead of a blank one.
- The overlay derived reads `viewZoom` (a derived primitive) instead of `view`, so a pan does not
  rebuild it.
