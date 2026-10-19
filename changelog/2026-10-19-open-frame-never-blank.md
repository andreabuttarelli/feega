# Opening a heavy frame keeps its picture

Selecting a landing frame on the GPU canvas blanked the tile for 0.3 s locally, 1–2 s in
production, before the live preview appeared. Three causes, each seen in screencast frames:

1. GpuFlow hid the GPU card as soon as the node entered `domIds`, before the DOM tile had drawn
   anything. Now the card stays until MotionNode reports `TILE_PAINTED` (poster decoded or player
   drawn); until then the DOM tile is transparent (`.gpu-dom-node.unshown`).
2. MotionNode's own player sat above the poster with an opaque brand background before its first
   frame. It is now `veiled` (opacity 0) until `DRAWN_EVENT`; opacity, not visibility, so the
   iframe keeps rendering.
3. Closing the chat panel grows the canvas; `renderer.resize` clears the WebGL backing and the
   next draw waited for a rAF the editor mount was blocking. `GpuScene.resize` now draws in the
   same frame when the backing grows.

A poster counts as shown only after `img.decode()`: WebKit fired `load` one frame before painting.

Guard: `tests/e2e/canvas-motion-open-heavy-never-blank.spec.ts` (real stack, heavy canvas copy,
chromium screencast + webkit-iphone screenshots, GPU and `?renderer=dom`). Before: GPU red on
both browsers (≈15 uniform frames on chromium); DOM green before and after.
