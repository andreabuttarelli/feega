# Shape builder tool

`DrawTool.ShapeBuilder` (key X, Shift+X on the canvas). With two or more shapes selected, `shapeRegions` cuts them into
the faces of their overlap (each region lists the shapes that cover it). `ShapeBuilderOverlay`
highlights the region under the pointer; click toggles a region into the merge set, Alt-click puts
it in the cut set; Enter or Escape applies `buildShapes`: the merged regions become one path shape
painted like their topmost source, every untouched region stays a shape of its own, cut regions
disappear, and the sources are removed. The video length is kept (the copies would otherwise stretch
it).

Agents reach the same result with `combine_shapes`; parity declares the tool against it.

Verified in a real browser: `tests/e2e/canvas-shape-builder.spec.ts`.

`boolean.ts` now exports `bottomFirst`, `polygonsInFrame`, `reshapedTo`, `shapesOf` for the builder.
