# Tall frames draw whole and sharp in Play

Play's `draw` path ignored the screen fit: a frame taller than the
device side (landing, 1440x4632) got a canvas fitted to 3840 but was
painted 1:1, so it came out cropped and enlarged on the WebGL core.

- `fitted_list` draws the list through a scaled, offset `use` of a
  library group, so the planner scales matrices, blur and scissors like
  a camera zoom. A list that already fits its canvas passes through
  untouched: the hot path gets no extra group.
- Play splits a frame taller than `STRIP_PX` (2048) into stacked
  canvases, each drawing from its own origin (`set_origin`), so it stays
  sharp instead of being downscaled. The plain WebGL2 backend cannot
  draw from an origin and keeps one canvas.
- `GlSurface::paint` copied an effect layer wider than the surface in
  one go and lost the overflow: a drop-shadowed card was cut at the
  surface edge. It now paints the layer in surface-sized `pieces`.
- The parity spec compared a ~300px blur of the canvas against Play.
  It now seeds frames at 1:1, zooms the canvas to 100% and crops both
  shots by frame width, not by box height (the canvas box keeps the
  stored height while Play uses the resolved one).

Discarded: a `by` transform on the GL surface — offscreen layers stayed
in list coords and were clipped.

The black band under the canvas landing frame is not a render bug: the
fixture's page hugs to ~4390px with real fonts inside a 4480px frame
that has no fill. `resolveView` estimates 4632 for the same page, so
the stored and resolved heights disagree; left for a separate fix.
