# Dragging a selected frame moves the frame

**Before.** Pointer-down inside a frame always ran `pickElement`: the element under the cursor
was picked on press, so a drag moved that element (often a full-page background shape) instead
of the selected frame. Independent of zoom; at low zoom it looked worse because children fill
the whole frame.

**Now.** `pressOn` in `src/lib/canvas/frame-select.ts` decides the press, in one place: a frame
selected whole (not inside with a picked child) + no Cmd/Ctrl = `Press.Host`. `GpuFlow` then
starts the normal node drag and keeps the press; on pointer-up without movement it runs the
deferred `pickElement`, so a plain click still selects the child. Cmd/Ctrl-click, Shift-click,
double-click and already-picked children are unchanged.

**Tests.** Unit rule in `frame-select.test.ts`; `tests/e2e/canvas-frame-drag.spec.ts` drags a
seeded landing at zoom 10/25/50/100/200% and checks the tile moved, no child picked, no new
revision, and that a click still picks the child.
