# Canvas videos: still frame until play

A canvas of 21 motion nodes froze on pan/zoom, desktop and phone. Measured on a seeded copy
(`tests/e2e/canvas-perf.spec.ts`, production build): static DOM was ~1.4k elements and no player
ran after load; the cost came from `MotionNode` mounting a live player (iframe + runtime, WebGL
for some docs) on every `pointerenter`/focus and keeping it 3 s after leave. A pointer sweeping
the canvas kept 3–7 players alive; a touch pan on phone mounted one per swipe.

Now one table in `motion-preview.ts` (`Sight × Intent × Still → PreviewMode`) decides: live only
in view after Play; one player canvas-wide (`Slots.playing`); Stop, a pointerdown outside the
node or leaving the viewport stops it. A node with no stored poster captures frame 0 once (one
node at a time, `Slots.capturing`) and saves it via the editor's `?/poster` action, so the next
load reads it. The inline editor keeps its own live player.

Measured and discarded: `onlyRenderVisibleElements` — no fps gain once players are gone, and
remounts raised phone heap 30→42 MB. No WebGL rewrite.

Open: posters saved by the editor are at 40% of the duration (`posterSecond`), not frame 0.
