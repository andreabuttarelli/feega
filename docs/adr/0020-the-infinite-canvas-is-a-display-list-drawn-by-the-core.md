# The infinite canvas is a display list drawn by the core

Context: the GPU canvas (`GpuFlow.svelte`, PixiJS v8) draws every node as a texture: frames as
stored posters or html-to-image snapshots of the DOM card (#821), cards the same way, chrome and
ports as Pixi graphics (#810). A snapshot is stale the moment the doc changes, costs a DOM paint
plus an upload per change, and on a phone the texture budget (128 MB) decides what is sharp. The
motion engine already has the opposite model (ADR 0019): doc → `DisplayList` → `gpu-core`.

Decision: the canvas becomes **one display list per frame of the screen**, built in TS from the
nodes and their docs, drawn by `gpu-core`. No node is ever an image of itself. Panels, menus,
chat, toolbars and text inputs stay DOM on top.

```
nodes + docs + camera + selection + peers + gesture state      (TS, pure)
   │  canvasScene()      frames: drawFrame(prepared, t) placed through the camera
   │                     cards:  card painters → path/text/image items
   │                     chrome: ports, edges, handles, guides, marquee, cursors
   ▼
DisplayList (screen space, one per animation frame) ──► gpu-core (wgpu: WebGPU / native; WebGL2 later)
   ▲
input: pointer/wheel/keys in TS ─► hit-test in TS on the same boxes ─► camera / gesture state
```

1. **Same contract as the editor.** A frame on the canvas is `drawFrame(prepare(doc), frame)`
   — the exact list the editor previews — composed by `canvasScene`
   (`src/lib/canvas/core/canvas-scene.ts`): camera affine `[sx,0,0,sy,tx,ty]` multiplied into
   every item matrix, mask and matte, blur and feather scaled, a screen scissor per frame. One
   pipeline, so a frame on the canvas and in the editor cannot disagree.
2. **Time.** Each frame is drawn at its own playhead: still frames at their poster time, playing
   ones (hover, `live`) at `now`. Only frames whose time moved rebuild their list; the rest are
   reused, so an idle canvas emits the same list and the core can skip the frame.
3. **Culling, not LOD by simplification.** Off-screen frames are not prepared or drawn
   (`visible` in `canvasScene`). On screen everything is drawn exactly; the only level of detail
   allowed is invisible: blur radius and feather follow zoom, text under 1 device pixel high is
   dropped (it covers no pixel), images decode at the size they occupy on screen.
4. **Hit-testing stays in TS** (`camera.ts`, `geometry.ts`, `gesture.ts` already do it on boxes,
   ports and wire curves). Rust would need the same boxes back over the wasm boundary for no gain;
   the core stays a pure renderer, testable without a browser.
5. **Memory.** No snapshot textures. GPU memory is the swapchain plus images actually on screen at
   their on-screen size (`decodeSize` per device stays), plus fonts' glyph atlas. Docs of
   off-screen frames keep their `Prepared` in an LRU (`lru.ts`), not their pixels.
6. **Backends.** WebGPU in the browser and native wgpu in the apps (same crate). WebGL2 needs the
   planned sparse-strips backend in `gpu-core`; until it exists `?renderer=core` falls back to the
   current Pixi canvas where WebGPU is missing, never to a broken screen.
7. **Migration.** `?renderer=core` (`Renderer.Core` in `renderer-flag.ts`) sits next to the
   current renderer; today it still loads `GpuFlow`, and each phase moves one layer into
   `canvasScene`. Pixi, html-to-image, the snapshot queue/cache and stored card previews are
   deleted when `core` reaches parity on the heavy canvas and becomes the default — not before.

## Phases

| Phase | In the core | Removed on that path |
|---|---|---|
| 1 | camera, culling, frames live from docs, frame background, selection outline | frame posters and snapshots |
| 2 | node cards, ports, edges, handles, guides, marquee, peers' cursors | card snapshots, stored previews, Pixi chrome |
| 3 | WebGL2 backend, default flip | PixiJS, html-to-image, snapshot cache/queue |

## Inventory: what each node is made of

| Node | Visual parts | Primitives needed |
|---|---|---|
| motion (frame, element, group) | doc drawn live, background, label, bar, ports (frame), selection/rotate handles | the doc's own list; text; paths |
| text | card, header (icon, name), body text clamped, status | rounded rect, text, icon paths |
| image | card, image fitted, generating shimmer, model chip | rounded rect, image, gradient |
| video | card, current video frame, play/progress bar | image (video source), paths |
| audio | card, waveform, play button, time | paths, text |
| doc / document / memory | card, title, text excerpt | rect, text |
| iframe | card, URL, page poster (external page cannot be drawn: named unsupported, stays a picture) | image, text |
| products | card, grid of product thumbs, names, prices | images, text |
| social_account_feed / social_post_mockup | avatar, handle, post grid / post mockup | images (circle clip), text |
| ads, influencer | card, thumbs, metrics | images, text |
| list, select, calendar | rows, chips, day grid | rect, text |
| effects, composition | inputs preview, parameter rows | image, text |
| model3d | 3D viewer: needs its own GL; drawn as its last rendered still, named unsupported | image |
| studio_batch | grid of outputs, progress | images, text |
| gen nodes ("Generate text/image/video") | prompt text, model menu, run button, progress | rect, text, paths |
| edges | wire curve, arrow, label, dashed while pending | stroked paths |
| chrome | ports, resize/rotate handles, guides, gaps, marquee, peers' cursors + names | paths, text |

Interactive pieces of a card (text fields, menus, buttons that open DOM) are drawn by the core and
become DOM only while focused — the overlay is placed from the same box the core used.

## Measuring

Before/after per phase on the heavy canvas copy (project `e472ff3c…`, canvas `b5a892f3…`): fps
while panning and zooming, GPU memory (texture bytes from `frame-stats`), time to first full
frame, in Chrome desktop and the WebKit iPhone profile.

## Core API for the canvas (gpu-core owns it)

Folding the camera into every item in TS re-serialises and re-parses every frame's list on each
pan. The core keeps frames instead:

```
raster.putGroup(key, frameList, pictures)   once per frame, again when its doc or playhead moves
raster.dropGroup(key)                       when a frame leaves the LRU
raster.drawScreen({ width, height, background, items: [...uses, ...chrome] }, pictures)
  use = { kind: 'use', clip, group: key, matrix: camera · box }   one per frame on screen
```

A `use` is expanded in the core exactly as `canvasScene` places a frame: matrix into every item,
masks and mattes, blur and feather scaled, the frame's screen rect as scissor, its background
drawn as a rect. A pan is a few `use` matrices. A `use` of a group never put is reported as
`<key> group` in the skipped list, never drawn wrong. Same API on WebGPU (`createCore`), WebGL2
(`createCoreGl`) and native (`Renderer::put_group`). Next: `cache: true` on a `use` keeps a still
frame as a texture at its on-screen scale.
