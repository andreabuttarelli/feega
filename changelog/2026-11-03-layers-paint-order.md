# Leftovers from the graphic case: paint order, gradient export, blended spans

- **Layers order.** Canvas nodes listed backmost first; clips sharing a track listed in array order
  while the later one paints on top. `layerRows` now lists nodes `frontToBack`
  (`paint-order.ts`, the same rule `GpuFlow` paints with: behind nodes first), and `trackRows`
  lists each track's clips reversed, also as parent scope. Motion-mode track groups keep
  timeline order: their clips run in sequence and never overlap. Auto-layout children keep flow
  order. Checked in the browser: `~/Documents/feega-videos/audit/fixes/leftover2-layers-order.png`.
- **Gradient export.** `codegen/paint.ts` wrote the stored angle; renderers add a quarter turn.
  Both now use `cssLinearAngle` (`fill/model.ts`). `fillLayersHtml` keeps its inline `+ 90`: it is
  stringified into exported pages and cannot import.
- **Blend in composed spans.** `vector_only` (`gpu-core/groups.rs`) folded blended paths and
  groups into a span; the span reached the compositor as a plain `use`, so composited blending
  never saw the blend. Blended items now stay their own item. Wasm rebuilt.
- **"This node no longer exists" after dragging an image into a frame: not root-caused.** With
  `quietGone` disabled, five browser runs (plain, selected first, layers open, large JPEG, undo/redo)
  produced no 4xx and no banner; every local-removal path drops the queued write (`sendSave`).
  `quietGone` stays.
