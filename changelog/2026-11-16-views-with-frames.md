# Breakpoint views load with their frame

On load a frame's views appeared 0.7–1.4 s after the frame's first real paint on desktop
(2–4 s at 4× CPU, and some never within 20 s). Two waits stacked up:

- the views' doc reached `GpuFlow` through `onsource`, which fired only after the base frame's
  worker build, so the views were not even asked until the base had been built;
- a view's first live build waited for `media.ready` (every image) before it was put, where
  the base frame shows its vectors first.

`onsource` now fires as soon as the source is fetched, so views resolve and build alongside
the base, and a view shown for the first time paints its vectors without waiting for images
(`showsBeforeMedia`), then repaints when they land.

Landings, view first paint minus base first vector paint: desktop median 1223 → 28 ms (max
1441 → 455); 4× median 2775 → 487 ms (max 4159 → 1955, none missing). Measured with
`tests/perf/canvas-frame-budget-viewload.spec.ts`.

Not done yet: views still build on the main thread one at a time; at 4× that leaves up to
~2 s on the slowest view. Building them in the base frame's worker pass is the next step.
