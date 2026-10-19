# `?renderer=core` draws frames live on the canvas

Behind the flag, `CoreFrames` (inside `GpuFlow`) loads each visible frame's doc at its head
revision (`motion/[nodeId]/source`, now with the brand tokens), draws its poster instant with
`drawFrame`, puts it in the core once as a group (`putGroup`, ADR 0020) and draws the screen as
one `use` per frame (`screenUses`): a pan sends only matrices. Pixi hides those frames' faces;
chrome stays Pixi for now.

- The WebGPU surface is premultiplied, so the core layer is transparent over Pixi.
- A frame the core cannot draw whole (any `unsupported` gap) keeps its poster: never drawn wrong.
- Only WebGPU hands frames over. On WebKit the WebGL2 core drew solid shapes see-through and
  dropped images in two frames, so there the flag falls back to today's canvas.
- Discarded: folding the camera into every item in TS (8 fps pan on the heavy canvas) and a
  `stage/show` scene cache in the core, superseded by groups.

Bench: `scripts/bench/canvas-core.ts` (Playwright, Chrome + WebKit iPhone, heavy canvas copy).
