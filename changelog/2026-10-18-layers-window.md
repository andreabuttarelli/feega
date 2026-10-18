# Layers renders a window of rows

Layers mounted every row: ~470 on the heavy test canvas, each with icons,
buttons and handlers. Every selection change walked all of them.

Now `rowWindow` (`src/lib/canvas/row-window.ts`) picks the rows in view of
the panel's scroller plus 8 of overscan; padding stands in for the rest.
A picked row outside the window scrolls into view by index.

Measured headed, heavy canvas copy, 1440x900, Layers open:

| | rows in DOM | click→paint p95 Chrome | click→paint p95 WebKit |
|---|---|---|---|
| before | 469 | 50 ms | 1377–2414 ms |
| after | 33 | 82 ms | 260–411 ms |

Scroll p50 is 16.7 ms on both engines before and after; WebKit p95 stays
noisy (38–125 ms) because the canvas behind dominates the frame.
Discarded: `content-visibility` alone keeps every row in Svelte's graph.
