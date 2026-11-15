# Canvas: a reflow slides the clips it only pushes along

A redraw patch drew again every clip whose laid props changed plus all their descendants: on a
landing section a hide or resize redrew dozens of clips with real fonts, so the patch budget sent
those edits back to the worker.

- `subtreeRedrawn` now keeps the shown items of a clip whose laid props changed only in `x`/`y`
  (same transform, items without masks, matte or scissor) and shifts their matrices by the move.
  Only the edited clip (and its subtree), clips that changed size or style, and the subtree of a
  slid clip that clips or masks its content are drawn again.
- A filter's `origin` stays put when a clip slides: it is the world origin of the parent, which
  the reflow did not move.
- Fixture check: resize 508/527, hide 507/530, show 507/530, colour 75/102 patched, 0 mismatches.
