# Canvas debug log

`?debug` (or localStorage `feega:debug` = `1`) logs startup marks, per-frame load steps, sources
requests with Server-Timing, and long frames during pan/zoom to the console. One module,
`src/lib/canvas/core/debug-log.ts`, subscribes to the existing performance marks through
`PerformanceObserver`, so nothing is added to hot paths and nothing runs when off.

Discarded: a `console.log` at each `markFrame` call site (cost when off, scattered).
Tile compositor events are not exposed to JS yet; the `[tiles]` tag is reserved.
