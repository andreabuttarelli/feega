# A double-click never moves an element out of its frame

User report: double-clicking a landing frame's elements destroyed it — six "Moved an element to
another frame" revisions in seven seconds, six new `element` nodes, then "This node no longer
exists" and an undo that did nothing.

- Cause: `grab` in `GpuFlow.svelte` decided "outside" against the base frame's
  `[data-frame-stage]` rect. In a Tablet/Phone view the pointer is always outside that rect, so
  every press-and-release on a selected element there posted `moveElement` to the canvas. No
  movement threshold gated the drag either, so a 1–3 px jitter on the base frame committed
  "Moved an element", and the gap strip and frame resize did the same.
- `carryOf` (`canvas-drop.ts`): a drag starts only past `DRAG_SLOP_PX` (4 screen px), and
  carries out only when the pointer leaves the frame being edited (its world box, the view's
  when editing a view). The same `pastSlop` gates the auto-layout gap/padding strips and node
  resize/rotate; `MOVE_SLOP_PX` is gone.
- Double-click in a breakpoint view now descends one level like the base frame (`onDouble`
  resolved the node only from `hitAt`, which knows no views).
- Undo of a move-out (`undo.ts`): the frame doc is restored first and must land before the
  created element is deleted. A missing revision refuses the gesture (`revision_missing`)
  instead of deleting the element and leaving the frame without it.
- The "node doesn't exist" toasts were follow-up `moveElement` calls for clips already moved
  (404 `element_not_found`); they stop with the cause.
- Guard: `tests/e2e/canvas-double-click-stays.spec.ts` (Ledgerline fixture, base + views,
  jitter, instance descent, move-out + undo).
