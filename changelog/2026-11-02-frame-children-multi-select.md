# Multi-select inside a frame, marquee on its background, drop into its stacks

From the mobile case study (`~/Documents/feega-videos/audit/case-mobile/FINDINGS.md`, M7, M8)
and the landing case study (#3).

- **M7 / landing #3.** `extendOf` (`canvas/frame-select.ts`) is the one table that says what a
  press on a frame does with ⇧, ⌘, both or neither; `extendPick` (GpuFlow) only reads it.
  - ⇧-click on a child picks it even when the frame was not entered yet (before: the frame was
    added to the canvas selection). Not when other canvas nodes are selected: those keep ⇧ as a
    canvas toggle, because picks live inside one frame.
  - ⌘-click with children already picked adds the deepest child; with nothing picked it is still
    the deep pick. ⇧⌘ always toggles the deepest child.
  - A drag on the background of a frame that is not selected, or any ⌘/⇧ drag on it, is a
    marquee over its children, as in Figma. The frame moves from its title, when it is
    selected, or when it is empty. Groups and free elements still move. The marquee picks the
    frame's top-level children (the page clip excluded), not every nested clip as before.
  - ⌘ on a picked element's move grip goes through the same table, so ⌘-drag never moves the
    frame.
- **M8.** `landIn` and `planFree` (`motion/move-plan.ts`) join the stack under the drop point
  through `dropInStack`, the function that already joins in-frame drags. Both the optimistic
  client plan and the server move use them, so an element moved from another frame or from the
  free canvas lands in the stack at the slot under the pointer.

Not done: no stack drop line while a free element is dragged over a frame (only the frame
highlight); Layers cannot drag a free element row into a frame. Layers ⇧/⌘-click on frame
children already extends through `pickLayers`; not changed.

Guards: `frame-select.test.ts` (`extendOf`), `move-plan.test.ts` (landing on a stack).
