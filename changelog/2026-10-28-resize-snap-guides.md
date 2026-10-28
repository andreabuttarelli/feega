# Smart guides while resizing tiles

Guides and snapping only worked on move. `snapResize` (`canvas/snap.ts`) reuses `nearest` and
`guidesFor` and snaps only the edges the handle drags (edge or corner) to other tiles' edges
and centres, same 6 screen px reach.

Path: resize gesture in `GpuFlow` → `snapResized` → box override + `snapGuides` (cleared on release).
Shift (aspect lock) snaps the better axis and derives the other from the ratio. Rotated tiles
and Alt (symmetric) resizes do not snap: the dragged edge is no longer a single line.
