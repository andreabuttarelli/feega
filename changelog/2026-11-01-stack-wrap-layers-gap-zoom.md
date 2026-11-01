# Stack fixes from the Stack video take

Four defects found while recording the Stack demo.

- **Wrapping a stack moved a button's label but not its pill.** Clip props are absolute in frame
  space; layout rewrote the boxes of flow items only. A group (or an absolute child) moved by
  its stack kept its members at the old place. `laidOut` in `motion-core/layout/resolve.ts` now
  carries every descendant the layout does not place by the shift of its nearest placed
  ancestor. Fixed in the layout, not in `wrapInStack`: any stack move had the same defect.
- **Dragging a stack child in Layers only restacked tracks.** `dropLayer` now routes a drop on
  a stack child (above/below) to `placeInStack`: reorder within the stack, or join the target's
  stack from outside.
- **A press between two stack children started a gap drag.** The slop (`DRAG_SLOP_PX`) was
  already applied; the hit area was the whole gap band. The band is now only a hover highlight;
  a small handle in its middle takes the drag. The stale selection outline seen in the same
  take was not reproduced in a test and is not addressed here.
- **⇧1 / ⇧2 stopped at 100%.** They shared the page-open cap. `fitView` takes a `FitPurpose`:
  opening a page keeps 100%, the commands go to 400%, the camera's maximum.
