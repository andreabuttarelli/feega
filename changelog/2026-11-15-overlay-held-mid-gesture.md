# Canvas: zooming no longer resends the selection overlay every step

A pinch on the user's canvas copy (uncapped frame rate) showed 58 of ~2,400 frames at ~31 ms.
Inside them: `setOverlay` 17 ms (stringify the whole fixed part, wasm parse, encode) and
`SentOverlay.changed` 4.5 ms (stringify every item to detect the change).

Cause: `coreChrome` stamps `strokeZoom` (16 steps per octave) and `labelZoom` on every chrome tile,
so each step crossed mid-pinch missed the world-overlay cache and rebuilt every ring and label item.

`settledZoom` (`src/lib/canvas/core/settled-zoom.ts`) holds both steps while `view.zoom` keeps
changing and applies them `GESTURE_QUIET_MS` after it rests. Mid-gesture strokes and labels scale
with the camera, then re-step. Discarded: a zoom uniform in gpu-core for screen-constant strokes —
right long term, but a Rust change owned elsewhere; the hold can go when it lands.
