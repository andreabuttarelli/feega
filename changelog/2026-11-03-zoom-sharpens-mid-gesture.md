# Zoom sharpens during the gesture, never past 2× stretch

Perf audit round 2, hotspot 5: zooming a heavy canvas (30 landing frames) from fit to 400% showed the fit-zoom raster stretched 55× until the wheel stopped (HUD `rasterZoom=0.05` at `zoom=2.73`).

Before: `Retained::step` reprojected the held texture for the whole gesture whenever the last full raster took over 10 ms (`LIVE_FULL_MS`) and the old raster still covered the view — which a zoom-in always does. Group textures (`Library::plan`) were shown however stale while one re-rastered per 80 ms.

Now two stretch caps, each √2, so what reaches the screen is never stretched past 2×:
- `retained.rs`: during a zoom gesture, a held raster stretched past √2 (rough counts at half scale) is re-rastered sharp at the current camera. Rasters land once per half-doubling, not per frame.
- `groups.rs`: a cached group texture stretched past √2 is drawn live, culled to the view, until its sharper raster lands. Held (being edited) groups keep stretching as before. Centre-first re-raster order is unchanged.

Measured on the audit canvas (`.perf-audit` harness, desktop, CPU 1× / 4×): worst raster/zoom ratio during the gesture 0.018 → 1.0 / 0.82; mid-gesture HUD `rasterZoom` 0.05 → 2.73 / 2.24.

Discarded: rough (half-scale) rasters during zoom-in — at half scale they start at 2× and break the cap on the next wheel step.
