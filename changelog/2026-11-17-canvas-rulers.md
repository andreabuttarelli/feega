# Canvas rulers and guides

Frame rulers, per-frame guides (`userGuides` in the frame doc) and Shift+R already existed; they
only appear inside an open frame. Missing: rulers on the canvas itself.

`CanvasRulers.svelte` is one `<canvas>` over the surface: rulers top and left in canvas units
(`rulerMarks`, step from `tickStep`, so labels never crowd), plus the guide lines. It redraws when
`view` changes and costs no DOM per element. It shares `rulersPref`, so Shift+R and Preferences >
Views toggle both the frame rulers and these.

Guides are dragged out of a ruler, moved, and deleted by dropping them back on the ruler. Frames
and layers snap to them: `snapMoves` in `GpuFlow.svelte` applies `pullToGuides` after the neighbour
snap, same 6 screen px reach.

Guides are stored in localStorage per canvas (`canvas-guides.svelte.ts`), not on the server. Sharing
them needs a column or a canvas-level doc; not done, no migration in this change.

Not done: rulers do not pause during camera motion. They are one cheap canvas, drawn every frame
of a gesture.
