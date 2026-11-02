# Stack and import demo videos, second take

The first cuts (#1675) were too fast: drags were time-warped to 0.8 s and
waits were fast-forwarded, and the import one never showed the result.

- `demo.ts`: drags play in real time (no warp); `d.cut()` drops a wait
  as a hard cut instead of fast-forwarding it like `d.skip()`.
- `stack.demo.ts`: card with a real pill button (a stack with fill and
  label). Selection by clicks on the canvas, then ⇧A, direction, gap,
  width, alignment, fill ×2 / ×1, drag reorder, each with a hold.
- `import-layers.demo.ts`: live page, import, the whole imported page,
  sections zoomed from Layers, the Components page, an instance and Go
  to main, Code mode.
- `render.ts`: a screencast frame whose size differs from the first one
  (a navigation mid-take) is resized before the crop instead of failing
  with `bad extract area`.
