# Selection and reparenting follow Figma

From the nesting audit (`~/Documents/feega-videos/audit/nesting/FINDINGS.md`) and the props
audit C9. Each fix has a test that failed first, except the GpuFlow wiring, checked in the
browser (`audit/fixes/select-*.png`).

- **H2** `dropInStack` (stack-drag.ts): dragging a frame child that is not in a stack onto
  one joins it at the slot under the cursor, with the insertion line. Before, only a stack
  child could join another stack.
- **L2** `followCursor`: a reordered stack child follows the cursor through its transform
  offset while its slot stays open; the drop still commits `reorderChild`. Before, only the
  line moved. The dragged item draws under later tracks; not changed.
- **M6** `rowDrop`/`intoContainer` (layers.ts): the middle of a stack row, or of a clip row
  that holds children, drops inside it. An empty frame-like rect still has above/below only:
  nothing tells it from a rect.
- **H4** shift-click toggles the element a click would pick (`elementAt` Top), not the leaf.
- **M7/L8** `clickPick` (frame-scope.ts): with a container picked, a click released without
  moving picks the direct child under the pointer, and the hover ring goes to that child.
  A press still drags the picked container, as in Figma.
- **M8** `climbsUp`: ⇧↵ climbs like Esc; FrameTools no longer treats ⇧↵ as ↵.
- **H5** `covers` (gpu/pick.ts): a quad with no area never hit-tests. A 0×0 quad passed the
  sign test for every point, so an emptied hug stack caught every click. Empty stacks are
  still not pruned: `wrapped` in layout/ops.ts is being changed by the ⇧A work.
- **H8** `pointDraft`: double-click/↵ on a rect edits a path draft; the doc is converted only
  by the first point edit.
- **M12** the canvas draw layer mounts with a frame open, so the first drag draws.
- **L1** R/O arm rectangle/ellipse in Design mode; in Motion they stay timeline keys.
- **C9** `createComponent` keeps the instance in the parent and stack slot of the child.
