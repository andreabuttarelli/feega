# One box for a multi-selection; shadows no longer lose their edge

Basics audit #19, and a drop shadow defect seen on the canvas.

- **Multi-selection.** Two or more free elements/frames selected on the canvas had no box, no
  handles, and Properties closed. `GpuFlow` now draws one `FrameSelection` (`SelectionKind.Many`,
  body passes presses through so dragging a member still moves all) around `selectionBox`
  (`canvas/selection-box.ts`, rotated corners included). Scale handles run `ResizeMany`, corner
  zones `TurnMany`; both preview through `overrides`/`turning` and end in one `onPlaceMany`.
  The page turns it into one `many` undo entry (`place-many.ts`: turns, moves, resizes).
  Properties stays open (`selectionProperties.panel.box`), with X/Y/W/H/rotation in
  `NodeInspector`, Mixed where nodes differ.
- Resizes in a `many` entry run one after another: `undoStack.collect` is not reentrant, two
  concurrent collects left the stack collecting into a finished bucket and the next push vanished.
- A multi-turn awaits the server `rotateGroup` before moving the nodes: it rewrites `x/y` from the
  row it reads, and won the race against the move.
- **Shadow edge.** Selecting a shape with a soft drop shadow, then deselecting, left a 3 px band of
  canvas colour around it. The overlay change damages thin strips; `layers::region` clipped the
  filter layer to the strip, so the shape outside it never cast into it. The layer now spans the
  item's spread within the frame grown by the filter reach. Test: `tests/shadow_region.rs`.
- Discarded: damaging a group's spill instead of its box. The element group already includes the
  bleed, so damage was not the cause.
