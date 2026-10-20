# Multi-selection inside a frame, in the overlay

The shell already had multi-select state, align, group and a mixed inspector, but
`SelectionOverlay` only drew and dragged one clip: no way to build a selection on the stage.

- Shift-click on a clip toggles it (`toggled`).
- `Press.Marquee`: a press on bare background sweeps a rectangle (`swept`) instead of moving the
  frame. `Under` gains `Empty` (a frame with nothing on stage): there the press still moves the
  frame. A still press on bare background clears, as before.
- Members get an outline each plus one union box (`unionBounds`).
- Dragging a member moves the whole selection (`groupMove`: `snapMove` on the union box against
  the frame and non-member siblings, then `moveBy`). A still press on a member narrows to it.

Replaces "bare background moves the frame" from #997 for frames that have children.

Not done here: handles on the union box (scale/rotate), shift axis-lock while dragging a group.
Pure math in `src/lib/motion/multi-select.ts`, tests in `multi-select.test.ts` and `drill.test.ts`.
