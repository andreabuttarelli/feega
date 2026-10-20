# A phone sheet never hides what is selected; GPU frames hide handles while a part is selected

**Sheet over the selection.** On a phone, opening Properties (or any bottom sheet of the open
frame) over a selection low on the screen covered it: `phone-side-sheet` (f) measured the group
65 px under the sheet. Opening a frame on a phone still does not reframe (`REFRAME[Phone] =
Stay`, #814). Instead the shell reports every settled sheet change (`onsheet`), the inline
editor measures the free area again (`measuredFree`, the same docks `onframe` already used) and
the page asks the canvas for a `FocusMode.Reveal`: `revealIn` pans the least needed, no zoom,
and does nothing when the node is already in view.

**GPU handles.** `GpuTileChrome` drew resize handles whenever the tile was resizable; the DOM
tile also asks `chrome.handles`, which is false while a part inside the frame is the selection.
`canvas-poster-parts` :115 had failed since before 822f8e2f9 on this.

**Type fixes.** `BAR_H` had no `NodeMode.Leaving` row: sizing a leaving frame added `undefined`
(NaN height). `unanimated` in `MotionEditorShell` read `doc` above its declaration (template
only, so no runtime error); moved below.

**Spec drift** (no product change):
- `canvas-poster-parts`, `canvas-move-elements`: since #814 a press at frame depth moves the
  frame; the specs drill with a double click. A double click on a text opens it for typing, so
  `canvas-move-elements` presses Escape (text stays selected) before dragging it out.
- `canvas-move-elements` "an image node connected to a frame…": removed. Frames take no inputs
  since e9b38b06d.
- `canvas-move-elements`, `canvas-output-pixels`: on the GPU canvas a generated node's DOM body
  (`.gen-body`, with the drag-to-frame handle) mounts on hover; the specs hover the tile first.
- `phone-side-sheet`: (d) drills with a double tap; (f) asserts the + tab (#858) instead of the
  removed phone add bar.
