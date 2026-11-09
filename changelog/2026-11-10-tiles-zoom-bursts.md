# Tiled canvas: no raster bursts while zooming

Zoom p95 sat at 33 ms with `?coreTiles`. Two causes, both bursts of 2x2 batches (20-58 ms) in one
frame: zooming out never counted the sharper tiles already held as cover (`covered_within` only
looked at coarser steps), and after a pan every tile blurrier than 2x was rastered in batches.
Now finer held steps count as cover; during a gesture only tiles with no cover at all raster in
batches, blurry ones one tile per frame. Idle prefetch also stops when the browser reports
pending input (`navigator.scheduling.isInputPending`, Chromium).

A/B landings, CPU 1x, 5 interleaved, flag on, dev vs this: zoom 56→57 fps, p95 32→18.4 ms, worst
81-100→69-98 ms; pan, fit, drags, time to sharp unchanged.
