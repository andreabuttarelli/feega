# Element drag lifts the element instead of rebuilding the frame

Before: every pointer move of an element drag set the live doc, and `CoreFrames.rebuildLive`
re-prepared and redrew the whole frame's display list (and its breakpoint views), spliced it and
patched a new core group, which gpu-core re-rastered whole. Pickers, breakpoint view docs and
some inspector sections were also recomputed from scratch per move. Landings bench: ~10 fps at 1x.

Now (`Lift` in `src/lib/canvas/core/lifted-drag.ts`):
- first move: `CoreFrames` patches the frame group into `:rest` (one splice gap, `liftOut`) and
  puts the dragged subtree alone as `:moving`; both are drawn as held textures. Each move only
  shifts the moving use (`liftedPut`). Rebuilds of the frame and its views are skipped while
  lifted.
- the live doc still updates per move (inspector values, guides); pickers and view docs are held
  (`reuseOf`), and selection marks are shifted by the same offset.
- pointer-up commits as before; the lift stays until the committed rebuild is drawn.
- per-move costs cut: `laidClip` lays a doc out once, `stylesOf`/`clipColours` index once,
  `dragClips` snap targets computed once per drag, `stackUnder` tests the box before ancestry.

Not lifted (old path): stack children, scoped edits, breakpoint views, subtrees not drawn
contiguously or inside an isolating ancestor group. While lifted the moving layer draws above
its siblings; after release the order is the real one. The first ~1 s of a drag still pays the
held-texture raster of both layers (gpu-core, untouched here; see `perf/layer-cache`).

Bench: `BENCH_GESTURES`, `BENCH_PROFILE`; the profile now covers the gesture window only.
