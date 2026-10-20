# Core canvas: the edited frame is drawn from the editor's own doc

Steps 2 and 3 of the overlay direction, first part.

- `MotionEditorShell` publishes its live doc to `liveDocs` (`live-docs.svelte.ts`) on every edit
  when hosted on the canvas. `GpuFlow` passes the map to `CoreFrames`, which builds the frame's
  display list from it (`buildSource`, same path as a fetched source) under a `live<n>` group and
  draws that instead of the saved revision. An edit shows the next frame, not after the save and
  the revision bump; stale builds are dropped by a per-frame generation.
- When the editor closes the live group stays until the saved revision changes
  (`liveAtRevision`), so deselecting never flips back to the old doc and never refetches or
  rebuilds when nothing changed; when the new revision lands the previous picture is kept until
  it is drawn (`drawnLast`), as for any rebuild.
- `fitTexts` no longer runs on open: it writes DOM-measured text boxes into the doc, so it waits
  for the first user edit (`userEdited`).
- Text editing in core mode: the live host stays hidden except the contenteditable, whose text is
  transparent (caret and selection stay visible), so the core's glyphs are the only text on screen.

Checked on b5a892f3: select an element inside a frame, nudge it with Shift+Arrow; the core shows
it moved within 300 ms, before the save. Not done: element boxes from core layout metrics for
`SelectionOverlay`/`fitTexts` (they still read the hidden DOM host, whose layout matches at 1x),
and text edit with a real caret was not exercised by a script.
