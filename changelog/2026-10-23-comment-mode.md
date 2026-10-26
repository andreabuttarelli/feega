# Comment mode

Comments (#757) were only addable from the panel, pinned to the selected node or the middle of
the view.

- `C` or the Comment button in the bottom bar turns comment mode on; Esc or `C` turns it off. A
  click on the canvas then drops a pending pin and opens the panel on it.
- `commentPlacement` decides the pin: the topmost node under the click (frames included) with
  x/y relative to its top-left, so the pin follows the node when it moves; empty canvas pins to
  the canvas.
- The click is taken in `GpuFlow.onDown`, before selection, so it never starts a drag or a
  selection. Touch is left to pan and pinch.
- Bare `C` now belongs to the canvas: the old "stays global" case in `shortcuts.test.ts` was
  stale, the global registry has no `g` prefix any more.
