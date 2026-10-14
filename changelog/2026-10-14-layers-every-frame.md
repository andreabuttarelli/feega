# Layers: every frame's children, one selection, hover outline

Three defects in the Layers panel, fixed together because they share the row model in
`src/lib/canvas/layers.ts`.

**Two rows selected.** `LayersPanel` kept its own `picked` list next to the canvas and editor
selections and lit a row if any of the three named it. Pick node A in Layers, click node B on the
canvas: A stayed lit. Now the panel holds no selection: `selectedLayers` derives it from the
canvas and the open editor (the editor's picks stand in for the frame being edited, a part for
its clip), and `rowPicked` also matches the frame, so a clip id shared by two frames lights up
only in the open one. Shift and ⌘ both add/remove, as on the canvas; the old shift-range is gone.

**Only the open frame unfolded.** Closed frames now list their tracks and clips from the latest
saved revision. `GET /p/[projectId]/c/[canvasId]/frame-outlines?heads=id:version,...` reads every
requested head in one `readHeads` query and answers `frameRows` per frame. The client caches by
`nodeId:version` (`frame-outlines.ts`); a new `docHeadRevision` arriving via realtime on `nodes`
changes the key, so only that frame is refetched. Closed-frame rows are read-only (`nested`).
Clicking one selects the frame (which opens it inline) and then picks the child once the editor
publishes.

**Hover.** Hovering a row outlines its target in `--ui-hover-outline` (new token, violet, never
the accent): the node on the canvas, a closed frame for any of its children, the clip or the
poster part inside the open frame. Hovering a clip in the open frame lights its row back.

Not done: a child of a *closed* frame outlines the whole frame, not its own box. Element boxes
are measured in the browser by the renderer and never stored; storing them per revision is a
separate change. Part rows (poster text blocks) likewise only appear once a frame is open, for
the same reason.
