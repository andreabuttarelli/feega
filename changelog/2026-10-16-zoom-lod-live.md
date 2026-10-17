# Poster LOD switches during the zoom gesture

Before: `CanvasPosterLayer` set the `poster-lod` class through a 150 ms timer reset on every
viewport change, so during a continuous wheel/pinch it fired only after the gesture ended
(~560-710 ms after crossing `LOD_ZOOM` in e2e).

Now: `lodNext(active, zoom)` decides on every viewport update, with hysteresis (enter below
`LOD_ZOOM`, leave above `LOD_EXIT_ZOOM` = 1.05x) so the boundary does not flicker. Thumbnail
decoding and image-tier/video-mount planning (`CanvasImageTiers`, 250 ms settle) stay deferred.

Cost: phone 4x CPU zoom sweeps show 1-8 long tasks (vs 0) from the mid-gesture style flip of all
poster nodes. Numbers and videos: `~/Documents/feega-videos/zoom-lod/`.

The poster-lod e2e helper now waits for `.moving` to clear after mount: the old specs had used the
timer as a settle signal.
