# A frame's children are free on the canvas

Since #814 a press at frame depth moved the whole frame (`pressOf(Depth.Frame, Move)`), and the
queued click of a closed frame was dropped (`selectsFrame`), so a child could only be picked or
moved after a double-click "entered" the frame.

`pressOf` now takes where the pointer is (`Under.Child` / `Under.Bare`). On a selected frame a press
over a child picks it and the existing overlay drag moves it, with the snapping and guides it
already had against the frame edges, the frame centre and the sibling bounds. A press on bare
background moves the frame at every depth; a still press on bare background with a child selected
selects the frame again. A click on a closed frame selects the child under the pointer again.

Kept: dragging out of the frame un-parents (`ondragout`), dropping a free element into a frame
reparents (`frameUnderPointer`), Delete removes the selected child, hover outlines the child a
click would select.

Not done: the first press-drag on a frame that is not selected still moves the frame, because the
editor (and its hit test) mounts only after the frame is selected. Drawing a shape over a frame
still creates a free element.

Covered by `drill.test.ts`, `scene-select.test.ts` and
`tests/e2e/canvas-frame-free-children.spec.ts` (`@real`, test account).
