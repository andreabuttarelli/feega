# Free shapes move as one object; deselect reloads nothing

## Before

A free shape is a chromeless motion node (`kind: element`) holding one
clip. Selecting it mounts the inline editor in the tile. From then on:

- a drag on the shape went to `SelectionOverlay` and moved the clip
  INSIDE the node (Offset X/Y): clipped, "disappeared", node never moved;
- a drag in the ~200 ms before the editor stage was shown hit the hidden
  (opacity 0) stage and was lost;
- the anchor grip sits at the shape's centre, so grabbing the middle
  moved the anchor, not the shape;
- a corner handle scaled the clip inside a node that did not grow.

On deselect the tile mounted a fresh player (new iframe, fonts refetched)
and handed over from the editor stage when it drew: an invisible reload.

## Now

- `Chrome.dragsHost` (true for `element`): move and scale grips call
  `onhostdrag` with a `hostShift` (pure, tested) instead of editing the
  doc. The canvas page moves/sizes the node live and commits through the
  existing `move`/`resize`/`moveEnd` path (place-save queue, undo, drop
  into a frame via `tileDrop`). The anchor grip is hidden for these.
- The editor stage takes no pointer events until shown; the tile host is
  `nodrag` only once the editor layer is up.
- `Chrome.under = Under.Kept` for elements: the tile's own player stays
  mounted (hidden) under the editor, so deselect only reveals it.

Rotate on a selected free shape still rotates the clip inside the node.

Guard: `tests/e2e/canvas-free-box-fluid.spec.ts`.
