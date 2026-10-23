# Ctrl suspends snapping, drags land on whole pixels

`dragClips` takes a `SnapMode`: `Guides` (default, as before), `Off` (Ctrl: no sibling, guide or
frame-centre snap, so no guide is drawn) and `Pixels` (guides plus a final shift so the dragged
box starts on whole pixels). `GpuFlow` picks `Off` while Ctrl is held and `Pixels` while the pixel
grid view is on, which is its default. The pixel grid itself now appears from 400% (was 800%).
Browser check: `tests/e2e/canvas-snap-suspend.spec.ts`; whole-pixel landing is unit-tested only.
