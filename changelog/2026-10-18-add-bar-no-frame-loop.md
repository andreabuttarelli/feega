# The bottom bar stops reading layout every frame

While a frame was open, `CanvasAddBar` ran a `requestAnimationFrame` loop that
called `querySelectorAll` and `getBoundingClientRect` on every frame to keep
itself above the timeline and the phone's bottom docks. During a drag or pan
that read forced a layout after every canvas write.

Now `followDocks` (`src/lib/canvas/dock-lift.ts`) reads once, then again only
when the host, a dock or the window resizes; it re-observes when the dock set
changes.

Headed Chrome, heavy canvas copy, CPU profile, time inside the add bar:

| gesture | before | after |
|---|---|---|
| drag (90 moves) | 30.9 ms | 0 ms |
| pan (90 wheels) | 34.7 ms | 0.6 ms |
| zoom (90 wheels) | 23.9 ms | 2.0 ms |

Risk: a dock that moves by transform without resizing is no longer followed.
None does today. The `@real` bar specs did not run here (they create orgs).
