# Graphic case study fixes

From the graphic case study (2026-11-02, canvas 8185f29b, test account). Each fix has a test
that failed first; each was checked in the browser (`~/Documents/feega-videos/audit/fixes/graphic-*.png`).

- **B3, image file dropped on a frame.** The drop handler sent every file to `upload(file, at)`,
  so it became a canvas node on top of the frame. `fileHolding` (`frame-holding.ts`) routes an image
  dropped on a frame through the existing upload-into-frame path, at the drop point.
- **B3, image node dragged into a frame.** `holdFrameDoc` (`GpuFlow.svelte`) only kept the target
  frame's asset URLs, so the moved image drew blank until reload. It now adopts the dragged node's
  URLs. The frame session's `adoptSaved` takes the move as already saved, so undo no longer leaves
  the image in the frame. A save that fails with `Gone` for a node this tab already removed
  (`quietGone`, `node-save.ts`) no longer shows "This node no longer exists".
- **M1, image fill invisible until reload.** The frame's asset-URL map was only filled on load.
  `missingAssets` (`live-assets.ts`) adds URLs for asset ids a recorded edit introduces.
- **M2, image fill empty state not clickable.** `media-add` opens the file picker; Link and
  Library moved behind `media-more`.
- **M3, boolean result was a "Group 1" precomp with frame bounds.** The bar now runs
  `combineShapes`: one shape, tight box, named after the op, strokes dropped (the faint rim was
  the bottom shape's stroke tracing the new outline). Live boolean groups are no longer made from
  the bar; existing ones still switch op and flatten.
- **M4, top-left pivot.** `TOP_LEFT_START` (Oct 20) stored anchor 0,0 on every new clip.
  `NEW_CLIP_START` stores none, so new layers pivot from the centre. Layers saved with an anchor
  keep it.
- **M5, blend on a group ignored.** `drawFrame` only wrapped a group in a Group item when it had a
  mask; a non-normal blend now does too, so the group composites as one layer.
- **M6, gradient angle changed with zoom.** The GPU display list and SVG turned the direction in
  normalized box space, skewing it on non-square boxes. Both use `linearEnds(angle, w, h)`.
- **M7, seams on pen strokes.** `scene.rs` filled each stroke band, join and cap separately;
  overlaps blended twice. The stroke is now one non-zero fill.
- **M8, point edit outside the box.** `commitOutline` (`vector-edit.ts`) refits x/y/w/h to the
  path on release.

Not done: `codegen/paint.ts` writes linear gradients without the +90° the renderers use (exported
code likely off by 90°); `vector_only` in `gpu-core/groups.rs` ignores blend for vector-only
groups inside a cached span.
