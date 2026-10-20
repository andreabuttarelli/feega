# Corner-radius dots follow a moved shape

`CornerOverlay` placed its four dots from `clip.props` alone (`boxOf`), ignoring the clip's
`transform`. A drag writes `transform.x/y`, so the dots stayed on the corners of where the shape
was while the selection box moved. Not a second overlay: one overlay (`SelectionOverlay`) owns the
selection box and scale handles, `CornerOverlay` owns the radius dots, and both are now placed
through `worldAt`.

`corner-handles.ts` holds the placement (`cornerHandleAt`) and its inverse for the drag
(`cornerLocalPoint`); the editor passes the live preview doc, so the dots follow mid-drag too.

Covered by `corner-handles.test.ts` and `tests/e2e/canvas-frame-child-handles.spec.ts` (`@real`,
test account). Rotation and parent transforms are covered by the same affine.
