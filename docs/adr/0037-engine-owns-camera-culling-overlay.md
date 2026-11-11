# 0037 — The engine owns camera, culling and the canvas overlay

Status: accepted 2026-11-12. Execution: four steps, one PR each, below.

## Context

Chrome trace, 4 s wheel zoom on the heavy canvas (`BENCH_CASE=heavy`, CPU 4x): the main thread
is the bottleneck, not the GPU.

| main-thread work | ms per 4 s |
|---|---|
| wheel `EventDispatch` incl. JS handlers | 1,417 |
| app JS (of which card-kit glyph contour translate/scale per card per frame: 326) | ~1,500 |
| wasm | 927 |
| style recalc | 441 |

17% of zoom frames are over 11.1 ms; the target is ≤2%.

Every frame JS does four things the engine could do in one call: it applies the camera
(`view`, wheel/pinch/pan math in `GpuFlow.svelte`), finds what is visible (`SpatialIndex` in
`src/lib/canvas/core/spatial-index.ts`, three indexes in `CoreFrames.svelte`), re-transforms
card text contours (`card-kit.ts`), and positions overlay DOM (`FrameOverlays`,
`FrameSelection`, `.hover-ring`, `.pick-outline`, `FrameGuides`, `.frame-marquee`) — each a
style write the browser recalculates.

Part of the overlay already crosses into the engine: `overlayOf` (`world-overlay.ts`) turns
wires, marquee, guides, peer outlines and frame chrome into `PathItem`s for `set_overlay` /
`set_live_overlay` (`web.rs`). It is world-space and re-sent only outside gestures, so it scales
with the retained screen during a zoom: #1936 moved the hover ring back to the DOM for exactly
this (stroke 2→6 px across one zoom). Names and selection rings still lag a zoom today.

Quick JS-side fixes (cached card contours, less style recalc, coalesced wheel events) land in
parallel and are the baseline every step here is measured against.

## Decision

Figma's split: **JS handles input and app chrome; the engine owns camera, culling and the
canvas overlay, and draws canvas plus overlay in one GPU pass.**

### What moves into `packages/gpu-core`

- **Camera and gesture math**: wheel zoom about the pointer, pinch, pan, inertia
  (`inertia.ts`), clamps. The engine holds the authoritative `(x, y, zoom)`.
- **Visible set**: an R-tree/grid over node and card boxes in Rust, replacing the three
  `SpatialIndex` uses; `world.rs` already indexes uses for tiles (#2001), so it is one index.
- **Card text transform**: glyph contours stay in world units in the engine; the camera is a
  single affine at draw time. No per-card, per-frame JS.
- **Canvas overlay**: frame names, selection rings and resize handles, hover ring, pick and
  layer-hover outlines, multi-select box, marquee, snap guides and measured gaps. Drawn in
  **screen space** after the camera is applied, so strokes stay 1.5 px and text stays crisp at
  any zoom — the defect #1936 worked around disappears instead of returning.

### What stays in JS / DOM

App chrome and panels, the toolbar, menus, text editing (`CoreTextEdit`), rename input
(`.name-input`), crop/gradient handles while active, prototype player, every DOM input, and
accessibility. Interactive DOM the user types into is placed at a rect the engine reports.

### The boundary

One call per frame, no SharedArrayBuffer (it needs cross-origin isolation, which embeds and
third-party fonts on this site would break; revisit only if the call shows in the trace):

- **In**: `push_input(kind, x, y, dx, dy, modifiers, t)` per raw pointer/wheel event, batched
  into a `Float64Array` and handed over in `frame(now)`. Kinds are an enum, not strings.
- **In**: overlay *state*, not geometry: `set_selection(ids)`, `set_hover(id)`,
  `set_guides(packed)`, `set_names(id → text)` — sent on change, not per frame.
- **Out**: `frame()` returns a fixed-layout `Float64Array`: camera `(x, y, zoom)`, a changed
  flag, and the visible id count; visible ids are read with `visible_ids()` only when the flag
  is set. JS keeps `view` as a mirror for DOM placement, written once per frame.
- **Hit testing**: `hit(x, y) -> { id, part }` where `part` is an enum (body, handle-n…se,
  name, rotate, port). The engine answers point queries against what it drew, so the handle the
  user sees is the handle that is hit. `rect_of(id)` returns the screen rect for placing a DOM
  input (rename on double-click).

Layering per CLAUDE.md: Svelte components call a `CanvasEngine` adapter in
`src/lib/canvas/core/`; only that adapter calls `web.rs`. Overlay looks come from DESIGN.md
tokens, resolved in JS (`CoreTheme`) and sent as plain colours and the radius scale
(`--ui-radius-*`) as numbers; Rust never reads CSS.

### Migration order

Each step is its own PR, test first, measured with `perf:budget` (heavy + landings) and a
Chrome trace of main-thread ms per 4 s zoom, with screenshots of selection, hover and drag in
light and dark:

1. **Overlay in the engine, screen space** — names, selection rings, handles, hover; DOM
   versions removed; `hit()` for handles.
2. **Visible set in Rust** — `SpatialIndex` deleted; `CoreFrames` reads `visible_ids()`.
3. **Camera in Rust** — raw input in, camera out; `onWheel` and pinch/pan math deleted.
4. **Card text transform in the engine** — card-kit stops transforming contours.

Every step ships behind the existing renderer switch: the WebGL/DOM fallback (`coreOff`) keeps
today's JS path until the step has a green week; then the JS path is deleted, not left
dormant.

## Consequences and risks

- **Text crispness**: overlay labels go through `text.rs`/`glyphs.rs` at device pixels; a
  regression is visible on the first screenshot, so step 1 compares against the DOM pixel by
  pixel at 0.1x, 1x and 8x.
- **Input latency**: events reach the camera one rAF later than a DOM handler would apply a
  transform. Mitigated by consuming input at the start of `frame()`, not the end.
- **Two sources of `view`** during migration: only one writes at a time, decided by the step
  flag; a test asserts JS never writes the camera once step 3 is on.
- **e2e selectors** (`node-hover-ring`, `frame-pick-box`, `frame-selection`) lose their DOM
  targets: tests move to `hit()`/`rect_of()` through `window.__gpuCanvas`, not to pixel reads.
- **Accessibility**: the engine draws, the DOM describes — an offscreen, ARIA-labelled list of
  selected nodes stays in Svelte.
- **WASM build size and churn**: every step touches `web.rs`; `npm run build:gpu-core` updates
  `core-version.ts` in the same commit, and steps rebase over the tiles/filters work in flight.
- **Stop rule**: if a step does not cut main-thread ms on the heavy zoom beyond the run-to-run
  range, it stops there (as in 0035) and the ADR records the number.
