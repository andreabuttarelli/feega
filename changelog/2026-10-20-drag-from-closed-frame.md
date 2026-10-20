# Drag a child straight from an unselected frame

#997 left one hole: the first press-drag on a frame that was not selected moved the frame,
because the editor (and its hit test) only mounts after the frame is selected.

`FrameHover` already measures the closed frame's elements on hover (`closedHover`). A plain
press that lands on one of them now stops the frame drag, opens the frame, and queues the click
with the held pointer (`DrillAsk.drag`, `frameDrill.release` clears it if the button is up
before the editor takes the ask). When the overlay mounts it picks the child and starts a move
grab from the original press point, capturing the held pointer, so the drag continues without
a jump. A press before the hover probe finished (no boxes yet) still moves the frame.

Not verified in a browser from this change; unit-tested: `frame-drill.test.ts`.
