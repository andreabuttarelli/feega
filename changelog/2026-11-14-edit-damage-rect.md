# Canvas: a patched item damages its own bounds, not the whole frame

An edit swaps a frame's use from group `f:liveN` to `f:liveN+1`. `World::patch` saw a group change
and damaged the frame's whole reach (old ∪ new), so every visible tile of the frame was
re-rastered under the per-frame credit, spread over several frames, before the edit was whole on
screen.

- `Library::patch_group` records, for the new group, the group it came from and the reach of the
  items it replaced plus the items it put (local coordinates, blur reach + 2 px). The reach is
  `None` when an item has filters, a backdrop, a matte, masks, or no computable bounds (text,
  glyphs, images, lenses): then the old whole-frame damage stays.
- `World::patch_edited` uses that reach when the use keeps its matrix and only switches between
  the two recorded groups; any other swap damages the frame as before.
- Applies to every edit that lands as a splice (`patchedFromSent`): the main-thread fast patch and
  worker rebuilds whose splice is small.

- `fastPatch` gains `Edit.Redraw`: when only one clip's `props` changed (resize, fill, radius,
  stroke…), the clip has no children, no keyframes, no mask pairing, is not text or a precomp, and
  no ancestor has auto layout or keyframes, the clip is drawn alone (`drawFrame` of a doc holding
  just it, its ancestors and the surface) and its items replace the old ones in the shown list. The
  worker build still lands after it. Text and auto-layout children stay on the worker path:
  layout and shaping are not reproduced on the main thread.

Measure: `~/Documents/feega-videos/perf/edit-latency/run.sh <worktree> <label>`; the spec now also
records input → first changed pixel (`pixelP50/pixelP95`) by sampling the core canvas around the
selection every frame, and takes `BUDGET_CPU` for a throttled run.
