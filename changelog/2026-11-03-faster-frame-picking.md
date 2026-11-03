# Frame picking reads the laid-out doc, and the frame doc is downloaded once

From the round-2 perf audit (`~/Documents/feega-videos/audit/round2/perf/`), hotspots 1 and 4.

- **Hotspot 1, before.** `framePicker` answered every click, hover, outline and drag step by
  composing the frame as HTML (`composeHtml`), parsing it (`DOMParser`), running its timeline,
  seeking it 121 times to learn what was animated (`animatedStyles`), scanning every script per
  layer, then walking every layer per query. A new doc object (every drag move) rebuilt all of it.
  Select ~70 ms at 1×, ~650 ms at 4×; a drag step ~68 ms at 1×.
- **After.** `placerAt` in `gpu-full/display-list.ts` places a clip with the same stage the GPU
  list is drawn from: prepared doc, world matrix, layout box, turn, move, edge pose, content cuts,
  wipe scissor, opacity (text fade-up included). `FramePlacements` (`src/lib/canvas/frame-placements.ts`)
  places clips lazily, caches per doc and frame, and indexes point queries on a 256 px grid.
  Owners are the clip's `Precomp` ancestors plus itself — exactly the `data-clip` chain the HTML
  carried (checked over 141 layers of the heavy landing). The `framePicker` API is unchanged.
- **Parity.** `frame-pick-parity.test.ts` holds picks, stacks and chains on a 16×16 grid
  (snapshot) and every outline (`frame-pick-outlines.json`, 0.5 px tolerance), recorded with the
  HTML picker before it was replaced: landing, its phone breakpoint, nested instances, rotated
  clips, a rotated tile, a clipped frame, groups on a surface, two playheads. Outlines differ from
  the HTML ones by ≤0.1 px (text widths the HTML rounded). The landing survey went from 20 s to
  0.7 s in jsdom.
- **Removed.** `src/lib/motion/gpu/{scene,pick,matrix,paint-of}.ts` and tests: the picker was their
  only caller. `pick.test.ts` cases moved to `frame-placements.test.ts`, which needs no DOM.
- **Hotspot 4.** #1786 (`frame-sources.ts`) already shares one download per source URL between
  the worker and the picker. What was left: the picker still asked for each doc itself, one at a
  time behind `quiet()` idle waits, so contents became pickable 8–16 s after open and the
  double-click drill-in missed. `CoreFrames` now calls `onsource` with the source it drew from and
  `GpuFlow.adoptSource` fills `fetched` at once; `fetchPickDoc` runs only when the GPU renderer is
  off.
- **Not done.** No incremental placement update during a drag: each move prepares the doc once
  (~3 ms at 1× on the heavy landing) and places only what is asked. The drag step is still bound
  by `CoreFrames.rebuildLive` (a full `drawFrame` per move on the main thread), outside this change.
