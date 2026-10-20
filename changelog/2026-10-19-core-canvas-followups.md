# Core canvas: grid layer, empty stills, fresh GL canvas

Follow-up to `2026-10-19-core-canvas-webgl.md`.

- **Grid layer.** A later PR moved the core canvas above pixi (`z-index: 1`), so the dots painted as the core canvas background covered every tile pixi still draws: black frames showed dots, and a pixi-drawn card hid a small frame. The dots now sit on their own `core-grid` element, beneath both canvases.
- **Empty stills.** A frame whose still has no items and no gaps counted as drawn whole, so the core painted only its stage colour. On the fixture, one doc has no clips while its poster shows a 3D render. `drawsWhole` now needs at least one item, so such a frame keeps its poster.
- **Fresh GL canvas.** When WebGPU exists but gives no adapter, its attempt had already claimed the canvas, and a canvas keeps the first context it hands out. Each backend attempt now mounts its own canvas (`{#key backend}`).
