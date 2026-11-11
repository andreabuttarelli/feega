# Canvas: per-paint counters leave Svelte state, the waiting count leaves the sort

Baseline on `dev` after #2006, #2015, #2024 and #2025 (zoom fixture, camera-tick bench): a pan
costs 37 Svelte reruns per wheel tick, a zoom 63. Two of the remaining per-tick costs were in
`CoreFrames.svelte`:

- `paintOn` wrote `paintedLabel` and `cacheBytes`, both `$state`, on every paint, only to show
  them as `data-painted` and `data-cache-bytes` on the canvas. They are now plain values written
  to `canvas.dataset`; tests and probes read the same attributes.
- `waiting` (the `data-waiting` count the benches settle on) sorted every placeholder by distance
  through `fillOrder` to count the ones on screen. `inView` (split out of `fillOrder` in
  `placeholders.ts`) filters without the sort.

Still open: `waiting` and the `data-posters` count are re-evaluated on most pan ticks although
none of their inputs change identity (an `$effect` watching them saw one change in 240 ticks;
Svelte's `is_dirty` re-executes them). `seenOverlays` in `GpuFlow.svelte` queries the cull index
on every tick because it reads `view`.
