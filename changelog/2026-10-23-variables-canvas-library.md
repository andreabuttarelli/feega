# Variables shared by the frames of a canvas

Third step of the variables work (spec in `feega-videos/plans/variables-spec.md`), same shape as the
shared styles library.

- `variable-library.ts`: library = union of the collections of the frame docs (first frame wins a
  name); `adoptCollection` copies one into a frame that lacks it; `syncedCollection` replaces it in
  a frame that has it, keeping that frame's own `active` mode.
- Canvas UI: `variableLibrary` store (like `styleLibrary`) wired in `GpuFlow`. An edit of a value, a
  mode or a variable in one frame is pushed to every frame that has the collection; a frame that
  lacks it is offered "Use here"; the clip section can bind a canvas variable straight away.
  Switching mode is never pushed: the mode is per frame.
- MCP: edit op `variables` (`canvas-variables.ts`): list, define (sync), mode (per frame or all),
  bind (copies the collection into the frame first). Tool pins updated on purpose.
- Verified in a real browser with two frames (`canvas-variables.spec.ts`).
- Known: removing a variable removes it in every frame that has it (and unbinds their clips); a
  frame edited elsewhere at the same moment can still lose the race to a version conflict, like
  styles.
