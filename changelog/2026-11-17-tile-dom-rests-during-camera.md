# Canvas: selected tiles drop their DOM chrome while the camera moves

Wide select-all zoom was slower than the same zoom with nothing selected even though the core did
the same work per frame: a trace showed style recalculation touching ~513 elements per pass with
everything selected against ~267 without. Each selected tile mounts DOM chrome — resize
handles, port names, add-beside, frame selection marks — that the GPU overlay already draws.

`tileDom` (`src/lib/canvas/core/camera-motion.ts`) maps a tile's DOM chrome through the camera
state: while the view moved within `GESTURE_QUIET_MS` it renders none; at rest it renders it all
again, so a pointer lands on real handles right after the gesture.

Measured (2200×1100 @2, uncapped, user canvas copy): select-all p95 9.3–9.8 → 9.0–9.2 ms, fps
~340 → ~400; style passes touch ~476 elements. Still above 8.3 ms: something else restyles the
selected tiles every frame; not found yet.

The directcopy probe gains `PROBE_TRACE` (main-thread event totals and elements per style pass).
