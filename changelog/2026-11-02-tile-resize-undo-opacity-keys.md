# Tile resize: real minimum, edge handles, undo; digits set opacity

From the basics audit (items 2, 3, 4).

**Frame snapped to 420×236.** The resize minimum of a tile was its creation size
(`nodeSize`): for a frame that is the Landscape default, 420×236, so a 120×80 frame jumped
to it on the first corner drag. The same clamp ran on the server (`resizeOnCanvas`), and
the doc follow-up (`followDoc`) then derived the height from that wrong width (420×289).
Now `minNodeSize` gives frames and elements the element minimum (8×8), on both sides.

**Edge handles did nothing on frames.** A frame's ports sit on its left and right edge
midpoints, and `hitAt` tested ports before resize handles, so the edge drag became a
connect gesture. On the selected tile the resize handle now wins; ports stay reachable on
unselected tiles.

**Resize was not undoable.** `MoveGesture` carries only x/y and resize pushed nothing,
while the inner doc refit pushed its own frame step, so ⌘Z undid only that (or the step
before). GpuFlow now reports the gesture once (`onResizeEnd`, box before and after); the
page applies it with the undo stack muted (`undoStack.muted`) and pushes one `resize`
entry. Undo/redo re-run the same placement towards the other box, with the move's stale
check (position changed by a peer → skipped).

**Digits inserted AI tiles.** 1–9 mapped to the add bar ("Generate 3D model" on 5) and 0
to fit. Now 1–9 = 10–90% opacity and 0 = 100%, as in Figma; inside a frame the existing
frame opacity keys still apply, on a selected tile the opacity goes on its root layers
(`tileFaded`). Fit stays on ⇧1.

Not done: undoing the creation of a frame and redoing it brought it back at 0×0 — seen
while testing, not in scope here.
