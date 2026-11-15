# Canvas: redraw patches within a budget, rebuilds after edits pause

After #2185 the landings hide patched 10/10, but its frame mark sat at ~326 ms while the pixel
probe said ~15 ms.

- Why: the hide of a top section child goes through the relayout redraw, which lays out the whole
  doc twice with real fonts (`exactLaid` of before and after): ~165 ms inside `fastPatch`, before
  the `live-asked` mark. The pixel probe saw the selection outline change (the core overlay
  layer), not the content. Same for resize: its 8.2 → 75 ms p95 "regression" is the drag
  preview/overlay competing with a heavier patch (instances are now patched), not the content,
  which lands at 74/114 ms as before.
- `PatchBudget`: a frame whose patch took more than 24 ms gets no redraw patches (no `look`) until
  its live doc is dropped; move/hide-shift/fade patches still run. The worker build is cheaper
  than a 165 ms main-thread patch.
- `paintFirst.afterQuiet`: the worker rebuild after a patched edit waits until the frame's edits
  have been quiet for 400 ms, then for a paint. Before, every edit serialised the whole doc
  (`sourceText`) after its paint.
- Tried: laying out only the edited root tree (`laidSubtree`). Top-level clips on landings are
  placed by the whole-doc layout (instance sizes, root positions), so a root-only layout
  mismatched; dropped.
- Not done: the selection overlay's full `withAutoLayout` per edit; `spliceOf` hashing (~0.3 ms
  per edit in the profile).
