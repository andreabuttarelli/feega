# Drawing, typing and moving inside a frame

Found while recording a demo; each reproduced with Playwright on the
test account (`tests/e2e/canvas-demo-ux.spec.ts`).

- **New layers started at the playhead.** `drawClip` places a video
  layer at the playhead (After Effects). Designing a static layout with
  the playhead at 1.8 s staggered every element. Now the frame's edit
  mode decides (`drawStart`): Design starts at 0 and spans the video,
  Motion keeps the playhead. Discarded: always 0 — it would break
  building a sequence in Motion.
- **Double-click on a new text opened no caret.** Cause above: the text
  began at the playhead and `Text` fades up, so at that frame it was
  transparent and the picker found nothing; the double-click then fell
  through to the frame (the "exits the frame editor" report).
  `pickHeld` lets a selected element answer inside its own box even
  while transparent.
- **An inserted image could not be moved.** `mediaElement` built the
  clip without component defaults, so its outline was NaN: no selection
  box, and the drag went to the shape below. It now starts from
  `defaultProps`. Also: a press on another element lying over a single
  selection now grabs that element (Figma); the frame picker is rebuilt
  when the assets change, not only the doc.
- **Guides instead of Properties on selection:** not reproduced, in
  local mode or on dev; selecting a frame element or a canvas shape
  opens Properties. Guides shows only once nothing is selected.
