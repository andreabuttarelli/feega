# Remove the DOM canvas

The canvas had three renderers: core (WebGPU, then WebGL2), Pixi (WebGPU, then WebGL), and the
SvelteFlow DOM canvas reached by `?renderer=dom`, by the PostHog kill switch `canvas-force-dom`,
or when every GPU path failed. Decision 2026-10-22: the GPU canvas is the only one.

Removed: `CanvasFlow.svelte` and the components only it mounted (`CanvasTile`, `CanvasKeys`,
`CanvasPointer`, `CanvasPeers`, `CanvasFollow`, `CanvasFocus`, `CanvasDots`, `CanvasMeasure`,
`CanvasImageTiers`, `CanvasPosterLayer`, `CanvasSelectionBridge`, `CanvasZoomLock`, `WireEdge`),
`tile-sync`, `image-tiers`, `selection-report`, the kill switch (`canvas-renderer-switch.ts`),
`Renderer.Dom`, the `@xyflow/svelte` dependency, their source-reading tests, and the e2e specs
and harnesses that measured or compared the DOM canvas.

Kept: the Pixi scene and its WebGL backend. It is the GPU canvas's own fallback when the core
renderer fails (no WebGPU and no WebGL2), not part of the DOM mode.

Browser support: core tries WebGPU, then WebGL2; Pixi tries WebGPU, then WebGL. Every current
Chrome, Edge, Firefox and Safari (15+) has WebGL2, so the DOM canvas was reached only with GPU
acceleration disabled or blocklisted. There GpuFlow now shows "GPU renderer unavailable"
instead of falling back.

The share page (`/s/[token]`) moved from `CanvasFlow` to `GpuFlow` in view mode. `Tile` and the
canvas props now live in `components/canvas/flow-types.ts`.

GpuFlow still renders `svelte-flow__*` class names in its DOM overlay and silently depended on
`@xyflow/svelte/dist/style.css`, which only `CanvasFlow` imported. The stylesheet is now vendored
as `gpu/flow-base.css` (MIT) and imported by GpuFlow; without it `canvas-frames.spec.ts` failed.
