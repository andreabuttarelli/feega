# `?renderer=core` draws frames live on the canvas

Behind the flag, `CoreFrames` (inside `GpuFlow`) loads each visible frame's doc at its head
revision (`motion/[nodeId]/source`, now with the brand tokens), prepares it, draws its poster
instant with `drawFrame`, composes all of them with `canvasScene` and hands the list to gpu-core.
Pixi hides those frames' faces; chrome stays Pixi for now.

- gpu-core gained `stage(list)` + `show(camera)`: the scene is built once and panned/zoomed as a
  transform, restaged when a pan leaves the staged reach, the zoom drifts past 1.4×, or 160 ms
  after a zoom settles (`stage-camera.ts`). Without it pan fell to 8 fps on the heavy canvas.
- The WebGPU surface is premultiplied, so the core layer is transparent over Pixi.
- A frame the core cannot draw whole (any `unsupported` gap) keeps its poster: never drawn wrong.
- Only WebGPU hands frames over; the WebGL2 core path showed alpha and image gaps on WebKit, so
  there the flag falls back to today's canvas.

Bench: `scripts/bench/canvas-core.ts` (Playwright, Chrome + WebKit iPhone, heavy canvas copy).
