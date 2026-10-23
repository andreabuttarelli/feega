# Drag elements between frames again, on the core canvas

#1151 removed the DOM inline frame editor, and with it the only two places that started a
cross-frame move: the editor's drag-out and the generated node's "drag into a frame" button.
`moveElement` and `placeOutput` stayed on the server, wired to nothing.

- `GpuFlow.grab`: a Move grip released outside the frame stage reports `onElementOut`
  (Over / Back / Drop); the page posts `moveElement` with the element's box, as the editor did.
  The in-frame live doc is cleared on drop so the source frame redraws from its new revision.
- `OutputDragHandle.svelte`: the "drag into a frame" button, shared by `GenNode` and, through
  `tileOver`, by core-drawn generated tiles (which have no DOM body to hold it).

Specs: `canvas-move-elements` selects through `frame-overlays` / `frame-selection` and the
drag handle instead of `selection-overlay` / `.gen-body`; `text-in-place` drives the `core-text-edit`
textarea instead of the removed preview iframe. Text editing in place was never broken.
