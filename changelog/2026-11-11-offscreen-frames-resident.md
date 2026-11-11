# Canvas: offscreen frames are built and kept, so panning never reveals an empty frame

With a bit of panning after load, every frame that had been offscreen showed empty for seconds.
Measured on the landings fixture (pan across the canvas at zoom 0.4, early pass vs the same pan
after 20 s): 13 of 24 steps had frames missing 4 s after open and still 16 at 8 s; with tiles off,
9 at 4 s. Three causes, all "only what is on screen":

- `resident` (residency.ts) kept a frame with pictures in the core only while it was on screen
  (`textured` counts visible items only), so offscreen landing pages were not in the world at all.
  Frames on screen keep priority; the rest of the budget now goes to the nearest offscreen frames.
- Frame builds were queued only for frames on screen (`fillOrder`); `toBuild` queues every frame,
  on screen first, then nearest.
- Cards and posters (breakpoint views) were readied only on screen; now all, on screen first.

Tiles also bake the whole canvas extent at the sharpest step that fits `CANVAS_TILES` (320 tiles,
about 86 MB), pinned against eviction, after the view levels — a pan far beyond the baked views
draws from it instead of nothing.

After: 2 of 24 steps differ (by 2.7–2.8% of the screen) at 8 s; 10 at 4 s, where the load itself
has not finished. Recordings: `~/Documents/feega-videos/perf/pan-reveal/` (before: `dev2`,
`devbase-8000`; after: `res-4000`, `res-8000`).
