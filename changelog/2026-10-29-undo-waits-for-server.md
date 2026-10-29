# ⌘Z right after a drop undoes it

Follow-up to #1591: pressing ⌘Z before the server answered a move-out found an empty stack and
did nothing — the gesture was pushed only after the response.

- `undo-stack.ts`: `pushPending(promise)` reserves the slot at gesture end; `popUndo` is async,
  awaits a pending slot, and skips one the server refused (resolved `null`). `nextUndo` had no
  caller and is gone.
- `+page.svelte`: `holdGesture()` reserves the slot. `landed` now takes the request promise, so
  every drop/move/copy/insert that goes through it (moveElement, moveFree, placeComponent,
  placeOutput, importFeedImage, copyElement, copyFree, insertScene, combineScenes,
  layersToFrame, upload into a frame) is undoable at once. Same for `regroup`, `saveFrame`,
  `saveDrawn`, and canvas drops of outputs and feed images.
- Kept as before (pushed on response): image tools, video reframe, create formats — ⌘Z must
  not stall behind a generation; paste/import paths are not gesture ends.

`tests/e2e/canvas-drill-in.spec.ts` was stale, not a regression: it drove the DOM editor
(`motion-editor`, `selection-overlay`, `part-box`, `.svelte-flow__node`) removed when the canvas
became the editor; `FrameHover` is not mounted on the GPU canvas. `canvas-nested-pick` and
`canvas-frame-child-pick` pass on dev. The spec now walks the agreed behaviour on the GPU canvas
with the nested fixture: hover = click target, double-click one level, ⌘ deepest, Esc up, Layers
in sync. `canvas-poster-parts.spec.ts` is stale the same way and still fails.
