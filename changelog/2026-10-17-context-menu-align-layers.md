# Context menu: align, mask, select layer, and inside frames

A design tool's right-click carries align, mask and "Select layer".
`CANVAS_MENU` in `canvas/selection-actions.ts` stays the one table; each surface says
which ids it can run (`canvasMenuIds`, `FRAME_MENU_IDS`) and `menuFor` keeps the shared order.

- Canvas: right-click → `CanvasContextMenu` → `SELECTION_RUN` in `CanvasFlow` →
  `alignTiles` (`canvas/align.ts`) → `onMove` per tile + one `onMoveEnd` (one undo), the same
  save queue as a drag. Align shows from two tiles. "Select layer" lists `tilesAt` the pointer.
- Frame: right-click on an element (not a poster part, which keeps its own menu) →
  `SelectionOverlay.openLayerMenu` → shell `runLayerMenu` → `frameMenuRun` → the existing
  `COMMANDS` (group, ungroup, duplicate, mask, delete) or `alignTo`. One element aligns to the
  frame.
- Parity: align on canvas → `move_node`; mask → `use_as_mask` / `release_mask`.

Left for later items: flip (needs the flip op), frame copy/paste and bring forward/back (frame
⌘C copies keyframes today). Mask stays frame-only: a canvas tile has no mask model.
GPU renderer: `GpuFlow`'s `SELECTION_RUN` must take the align ids and pass `available`/`layers`.
