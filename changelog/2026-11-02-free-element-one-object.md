# A free element is one object

Inspector and basics audits (2026-11-02, dev @ 7b74751e0). Root cause of props C1–C7, H3, H6,
H7, M11–M13, M15, nesting M1 and basics 1, 6, 7, 8, 9, 14: a free shape is an element node
holding a doc, and the inspector, the keyboard and the doc ops acted on the root clip in doc px
(two per canvas px for a drawn element) while the mouse acted on the node. Decision in
[ADR 0032](../docs/adr/0032-a-free-element-is-its-node.md).

- **One normaliser.** `settleElement` (`src/lib/motion/element-host.ts`) folds a root offset,
  size or turn into the node and re-stages the doc holding pixels. Runs on the canvas after every
  recorded edit (`GpuFlow.settleHost` → `onSettle` → `+page.settleHost`, no undo entry) and in
  `saveMotionDoc` for agents (`moveNode`/`resizeNode`/rotation). Replaces `elementTurn`. A turn
  is about the node centre whatever pivot the root was drawn with (drawn clips pivot top-left).
- **Undo.** `HostLedger` keeps the node box each doc was left with; a frame step back or forward
  restores it. Fixes undo of font size (H6), hand resize, rotate 90.
- **Inspector.** `spaceOf` (`units.ts`) is the stage as seen on canvas; `Basis.Pixel` and effect
  params declared `len` in the registry scale by `node.w / doc.width`. `ElementHost` (published
  by `GpuFlow.hostOf`) moves, resizes (same path as a handle drag) and turns the node; a scrub is
  one `liveEdits` gesture, one undo step. X/Y/rotation are `NumberField`s (scrub, units).
  Constraints hidden on the root of a free element (`pinnable`).
- **Drawn at 1×.** Elements are drawn at `ELEMENT_PX_PER_CANVAS_PX` 1 (frames keep 2 for export); a hand resize already re-staged element docs at 1×, so
  docs were mixed anyway. Legacy 2× docs still read right through `spaceOf`; they were not
  rewritten (rejected: a table of every px quantity just to rescale old docs).
- **Keyboard.** Arrows on the whole element move the node by 1/10 px with an undo step; `⌘D`
  duplicates the node (`wholeElementAction` table, which also holds wrap-with-stack).
- **Flip** moves the pivot to the middle first (`layer-props.centredPivot`), so drawn layers
  flip in place in frames too.
- **Text handles.** `handResized` wires the existing, unused `resizedFreeText`: dragging an
  auto-width text's side stops it hugging that side.
- **Bleed.** `drawFrame` sets `DisplayList.bleed` (`paintBleed`: effect reach + stroke width);
  `onStage` pads element and group pictures by it and `stagedBox` grows their draw box, so
  shadows and glows show past the node (C5). Frames keep clipping.

Not fixed here: H1, H2 (field), H4 (Enter keeps focus), H5 (Esc selects the hidden frame view),
basics 13 (opacity 50% renders correctly in the probe, not reproduced), a light rectangle under
a drop shadow's blur near the shape, legacy 2× element gap and padding of children only through
the node scale.
