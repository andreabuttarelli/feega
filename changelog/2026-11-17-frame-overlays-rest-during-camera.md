# Canvas: screen-space frame overlays sit out a camera gesture

After #2271, wide select-all zoom still restyled ~210 more elements per style pass than the same
zoom with nothing selected. A trace with invalidation tracking (`PROBE_TRACE`, now with
`devtools.timeline.invalidationTracking`) named them: the `.frame` boxes of `FrameOverlays` (for
frames and breakpoint views) and the many-selection box (`FrameSelection` handles, rotate and edge
grips) rewrite their inline `left/top/width/height` in screen pixels on every camera frame, and
each rewrite also invalidates layout.

While the camera moves (`CameraMotion.Moving`), `screenOverlays` keeps only the overlay of a frame
being typed in or cropped, and `shownAtRest` hides the many-selection box; both return at rest,
`GESTURE_QUIET_MS` after the last move. The GPU overlay keeps drawing rings and handles throughout.
The rules sit in one table in `camera-motion.ts`.

Wide 2200×1100 @2, uncapped, user canvas copy: select-all p95 9.0–9.2 → 7.8–7.9 ms, frames over
8.3 ms 209–236 → 169–180; nothing selected p95 7.1–7.6 → 6.9–7.0 ms; flicker 0/3.
