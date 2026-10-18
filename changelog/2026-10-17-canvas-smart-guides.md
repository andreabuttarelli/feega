# Smart guides on the canvas

Frames snapped to clips with guides; canvas tiles (frames, free elements, media) did not.
`snapDrag` (`canvas/snap.ts`) snaps the box around the dragged tiles to the nearest edge or
centre of any other tile within 6 screen px, on each axis, and returns the guide lines.

Path: `onnodedrag` in `CanvasFlow` → `snapped` → node positions moved by the snap, members of
a group follow the snapped position → `onnodedragstop` snaps once more and writes through the
same `onMove`/`onMoveEnd` as any drag (save queue, one undo). Guides draw in `MeasureLayer`
(canvas units), so the GPU renderer mounts the same layer with the same `snapDrag` result.

Not here: equal-spacing guides between three tiles (frame overlay has them; canvas next).
`tests/e2e/canvas-arrange.spec.ts` (@real, test account) walks right-click align, ⌃⌥T
tidy and a drag that snaps and shows a guide.
