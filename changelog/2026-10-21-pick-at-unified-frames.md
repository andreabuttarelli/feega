# pickAt: hover and click inside any frame from the core scene

Hover and click on elements inside frames used the DOM `FrameHover`/`PartsProbe` path, which needed a 200 ms dwell
and, in practice, the layers tree to have loaded the frame first. `pickAt`/`rectOf` (`motion/gpu/pick.ts`) now
hit-test the compiled core scene (z-order, transforms, rotation, clips). `frame-pick.ts` maps world point to frame
point and the outline back through the tile box (rotation included); `GpuFlow` draws the outline in the world layer
so zoom and pan cannot offset it. Frame docs are fetched in the background at canvas load (`/motion/:id/source`).
Flag `unifiedFrames` (default on; `?unifiedFrames=0` restores the old path). Step 2 of canvas-editor-unify.
