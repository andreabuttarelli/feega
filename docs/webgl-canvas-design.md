# feega canvas — hybrid GPU renderer (WebGPU first, WebGL2 fallback)

Status: design + spike (`webgl-canvas-spike`, draft PR to dev). 2026-10-17.

## 1. Choice

**PixiJS v8** (`pixi.js@8.21`, imported in the spike as alias `pixi8` because the motion
libs pin Pixi 7.4.3 for in-video use). One scene API, two backends:
`app.init({ preference: 'webgpu' })` tries WebGPU and falls back to WebGL2 by itself.
Batching, texture GC, BitmapText (MSDF + dynamic), TilingSprite, Graphics with shared
`GraphicsContext`, culling — all needed, all there, ~200 kB gz tree-shaken.

Rejected: raw WebGPU/regl/twgl (we would rewrite Pixi's batcher and text); Three.js (3D
scene graph, no 2D text/batching story); Konva/Fabric (Canvas2D, CPU-bound — the thing we leave);
Skia/CanvasKit (WASM 2–7 MB, text great but load cost and no WebGPU in browser builds);
Rust/WASM renderer (decision already taken — later only for CPU hot paths if measured).

## 2. Browser support and backend selection (Oct 2026)

| Browser | WebGPU | Used backend |
|---|---|---|
| Chrome/Edge ≥113 desktop (Win/mac/ChromeOS), Android ≥121 (most GPUs) | yes | WebGPU |
| Safari 26 (macOS 26 / iOS 26 / iPadOS 26) | yes, default on | WebGPU |
| Safari ≤18, iOS ≤18 | no | WebGL2 |
| Firefox ≥141 Windows; macOS/Linux rolling out | partial | WebGPU where `navigator.gpu` gives an adapter, else WebGL2 |
| Old/blocklisted GPUs, Linux Chrome without flags | no adapter | WebGL2 |
| No WebGL2 (rare) | — | stay on DOM canvas (current xyflow path) |

Selection (one function, one table): `navigator.gpu?.requestAdapter()` → adapter and
`device.lost` not fired → WebGPU; else WebGL2 context → WebGL2; else DOM. Pixi does the first
two; we wrap it to (a) honour a kill-switch `canvasRenderer=webgpu|webgl|dom` (URL param +
PostHog flag), (b) record the chosen backend in telemetry, (c) on `device.lost`/`webglcontextlost`
rebuild the scene from stores (scene is a pure projection, §4) on the next backend down.

Testing the fallback: the spike benchmark runs every scenario on both backends
(`pixi-webgpu`, `pixi-webgl`) — Playwright Chromium headless with `--enable-unsafe-webgpu` does
get a real WebGPU adapter on macOS. CI keeps one e2e that forces `webgl` and one that forces
`webgpu`, plus a unit test for the selection table (adapter null → webgl; context null → dom).
WebKit project (already in `playwright.config.ts`) covers the Safari path.

WebGPU-only features (progressive, never required): compute-shader culling + hit-testing
when node count > ~5k (GPU picking buffer instead of CPU scan); `copyExternalImageToTexture`
from `ImageBitmap`/`VideoFrame` without CPU copy; larger texture budget (default 512 MB vs
256 MB on WebGL2) and texture arrays for poster atlases; timestamp queries for perf telemetry.

## 3. What renders where

GPU (one `<canvas>`, below everything):
- **Grid**: one `TilingSprite` (dot tile), tile offset/scale = camera. 1 draw call.
- **Tiles**: per node a `Container` = border sprite + body sprite (poster / image / white) +
  `BitmapText` label. Static node chrome (title bar, badges) as sprites from one atlas.
- **Frames (motion)**: poster texture at every zoom; live texture only for the few frames in
  budget (§5).
- **Images**: tiered textures (256 px below LOD_ZOOM, 1024 px above), same tiers as today's
  `CanvasImageTiers`.
- **Video**: `VideoSource` from `<video>` for visible playing nodes (cap 4), poster otherwise.
- **Edges/wires**: one `Graphics` per layer, bezier as today's `WireEdge`; "iterate" style =
  dashed shader on the same path; only edges touching moved nodes are rebuilt (spike rebuilds all
  — measured cost below).
- **Selection, marquee, groups, ports, snapping guides, peer cursors**: overlay `Graphics` in
  world space, stroke width `/zoom` so it stays 1–2 screen px.

DOM overlay (absolutely positioned, transformed by the same camera matrix):
- the node **being edited** (one at a time: text input, inline motion editor, iframe node,
  3D viewer), context menu, selection toolbar, inspector, panels, chat. When a node enters edit
  mode its GPU tile hides and the DOM node mounts on top at the identical rect; on exit the DOM
  node snapshots to texture and unmounts.

## 4. Scene graph, camera, data flow

Camera = `Viewport {x,y,zoom}` (same type as `dot-grid.ts`), pure functions in
`src/lib/canvas/webgl/camera.ts` (`zoomAt`, `panBy`, `toWorld`, `hitTop`, `visibleIds`, tested).
`world.position/scale` = camera; nothing per node changes on pan/zoom except `visible` (culling).

Stores stay the source of truth: node store (local-first, realtime `nodes`, `version` OCC) and
`frameDocs`. A `SceneSync` adapter subscribes and diffs `{id, type, x, y, w, h, data-hash}` →
create/update/destroy display objects. The scene is never read back: drag writes to the store
(last-write-wins position, as now), the store echoes into the scene. Dependency direction:
stores ← SceneSync → Pixi; Svelte components never touch Pixi objects.

## 5. Motion frames → textures

Pixels from the HTML player — measured/assessed:
| Path | Cost | Verdict |
|---|---|---|
| Existing capture protocol in composed HTML (`feega:capture`, `FrameFormat.Bitmap`, html-to-image → `ImageBitmap`, transferred) | **~280 ms/frame desktop, ~350 ms at 4× CPU**; same-origin srcdoc iframe runs on the main thread → 80 ms long tasks | works today; use for posters + ≤1 "live" frame at 2–4 fps, **only in a cross-origin (OOPIF) iframe** so it runs in another process |
| Rendered MP4 (`lastRenderAssetId`) → `<video>` → `VideoSource` / `VideoFrame` | ~0.5 ms upload, 60 fps | best live path when a render exists |
| `canvas.captureStream`/`OffscreenCanvas` | only if the composition is itself a canvas | n/a for DOM compositions |
| `drawElementImage` / HTML-in-canvas (Chrome origin trial) | near-zero | watch; not shippable cross-browser |

Upload: WebGPU `copyExternalImageToTexture(ImageBitmap|VideoFrame)` (Pixi does it), measured
0.2–0.9 ms; WebGL2 `texImage2D(ImageBitmap)` 0.1–0.7 ms. Upload is not the cost; capture is.

Policy: far zoom (< LOD_ZOOM) → poster only. Near → posters; live budget = N frames (2 desktop,
1 mobile, 0 on battery-saver), picked by screen area then selection; live texture comes from the
MP4 render if fresh (`docHeadRevision` matches), else capture at ≤4 fps in a cross-origin iframe
pool (max 2 iframes). Opening the editor still mounts the real Hyperframes player in DOM.

## 6. Text and accessibility

Labels, titles, short card text: **BitmapText**, one dynamic font per weight (generated on demand
from the real web font, so Inter/brand fonts match). MSDF for the fixed UI font (crisp at 4×).
Long text (doc/text nodes): Canvas-2D → texture per node, re-rasterised at zoom tiers (0.5/1/2),
cached by content hash. Accessibility: a hidden DOM mirror (`role="application"` root, one
`role="button"` per visible node with `aria-label`, `aria-selected`) kept in sync by SceneSync,
receiving focus/keyboard; screen reader and existing `getByTestId` e2e selectors target the mirror.

## 7. Interaction (replacing xyflow)

Pointer events on the canvas element; Pixi event system off (`eventMode='none'`).
Hit-test: CPU, world point vs rects topmost-first; grid bucket index (cell 1024 world px) when
>1k nodes; ports/handles tested first with a screen-px radius. Gestures as a small state machine:
idle → pan (middle/space/empty-drag) | drag (node) | resize (handle) | connect (port → port,
ghost wire, `target_handle` resolved) | marquee (shift/empty-drag on desktop) | pinch (two
pointers, `zoomAt` around midpoint) ; context menu on right-click/long-press → DOM menu.
Keyboard shortcuts stay in `CanvasKeys`. Selection set lives in a store, so the inspector and
selection toolbar keep working unchanged.

## 8. Texture memory budget

Budget by backend (WebGPU 512 MB, WebGL2 256 MB, mobile 128 MB). LRU keyed by url+tier;
counted bytes = w·h·4·(mips? 1.33:1). Evict non-visible first, then lower tiers. Posters at
512 px (1 MB each) → 500 frames = 500 MB, too much: posters off-screen drop to 128 px tier
(64 kB). Spike scene: 50×512² + 50×256² ≈ 65 MB GPU, JS heap 54–77 MB vs DOM 123–225 MB.

## 9. Migration behind a flag (layer by layer)

Flag `canvas_renderer` (default `dom`). Every step keeps the DOM path and its e2e intact; each
gpu step adds the same e2e run with `?canvasRenderer=webgpu`.
1. Background: grid + posters (replaces `CanvasPosterLayer`/`CanvasDots`), xyflow still on top.
2. Edges + selection outline + marquee on GPU; xyflow nodes still DOM.
3. Tiles on GPU; DOM node only when edited; hidden a11y mirror carries the test ids.
4. Interactions (drag, resize, connect, context menu) move off xyflow; xyflow removed on gpu path.
5. Live frames, video, text tiers. 6. Flip default per browser after a week of telemetry.
E2E guards: selectors move to the mirror, so `canvas-*` specs stay meaningful; pixel checks
(`selection-outline`) read the GPU canvas via `toHaveScreenshot` on both backends.

## 10. Risks

1. **Live motion frames**: html-to-image capture is 280–350 ms and blocks the main thread when
   same-origin — needs OOPIF sandbox or MP4 renders; otherwise "live" is 3 fps. Main risk.
2. Text fidelity vs DOM (kerning, emoji, RTL) — BitmapText/Canvas2D tiers must match the editor.
3. Two renderers to test (WebGPU/WebGL2) + the DOM path during migration: CI time.
4. GPU device loss on mobile Safari (tab background) — scene must rebuild from stores fast.
5. Rich nodes (iframe, products, social feed) need a static texture snapshot or stay DOM.
