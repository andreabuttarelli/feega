# Canvas: overlays and card faces stay put while the camera moves

Measured with `tests/perf/camera-tick-bench.spec.ts` on the zoom fixture (60 frames, 160 cards),
a plain pan reran work over every node in `GpuFlow.svelte` and the canvas page:

- `placed` read the live doc of every tile through `liveOf`, though only free-image elements use
  it. `liveDocs.map` is one `$state` Map, and frame sources land while a pan brings frames near,
  so `placed` changed on 2 of 5 wheel ticks and rebuilt both card face tiers (`basesAt`) and every
  card's display list. `elementDocs` (in `free-image.ts`) keeps the previous map while no
  element's doc changed.
- `basesAt` asked the page for each card's view through `sourceView`, which used `nodes.find`:
  O(n²) per rebuild. It uses the existing `nodeById`.
- `FrameOverlays` placed one box per frame in screen pixels from the camera, so every tick rewrote
  every box's style. The boxes now sit in one container translated by the camera (a pan writes one
  transform); sizes still follow the zoom, so only frames within half a screen of the view, plus
  the one being edited, typed in or cropped, get a box.
- The sticky-DOM check, live-code culling and running spinners scanned every tile per tick; the
  comments pin target scanned every tile because the page kept the view centre as `$state`.

Not done: the chrome overlay is still rebuilt at every stroke-zoom step (`chrome.ts`, sent whole
through `setOverlay`); that needs zoom-free strokes in the engine.
