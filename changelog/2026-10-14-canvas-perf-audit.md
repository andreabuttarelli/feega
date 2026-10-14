# Canvas perf audit against the React Flow checklist

Checklist: reactflow.dev/learn/advanced-use/performance, dev.to "How I optimize my React Flow
application". Measured on the motion harness, 50/200/500 nodes, Chromium + WebKit, 4x CPU.

- Node components: Svelte 5 updates per signal, no memo needed. Measured: a 60-step drag mutates
  only the dragged node (61 mutations, 1 node); a selection click touches 1-2 nodes; pan and
  zoom touch 0 nodes. No change.
- Whole-`nodes` reads in parents: `CanvasSelectionBridge` reads `nodes` and the viewport, so it
  reported on every pan frame and drag step even with nothing selected; each report replaced
  `selection` and re-ran `settleSettingsColumns` (maps every node). Fixed with `reportChange`:
  nothing selected => no report; box moved => toolbar only; ids changed => settle + callback.
  Parent updates: 45 per 1.5 s pan -> 0, 60 per drag -> 0.
- `nodeTypes` and handlers: module-level constant and stable functions already.
- `onlyRenderVisibleElements`: wins under 4x CPU in Chromium at 500 nodes (zoom 11 -> 46 fps),
  regresses WebKit overview pan (53 -> 38 fps) because zooming out mounts hundreds of nodes
  mid-gesture. Not adopted.
- Yield to the main thread: no long JS loops on the gesture path (JS per frame p95 < 1 ms on
  pan at 500 nodes). Not adopted. Workers: no heavy compute to move. Not adopted.
- Heavy content when zoomed out: the cost is raster of posters while zooming, not JS. Bare Svelte
  Flow at 500 nodes holds 60 fps on WebKit zoom; feega 500 drops to 52/26. Addressed by the
  level-of-detail layer, separate PR.

`tests/e2e/canvas-stress-benchmark.spec.ts` compares the React Flow stress demo, bare Svelte Flow
and feega nodes on the same sweeps; `canvas-frame-budget.spec.ts` now runs 50/200/500 nodes,
counts per-node DOM churn and accepts `CANVAS_PERF_THROTTLE=4`.
