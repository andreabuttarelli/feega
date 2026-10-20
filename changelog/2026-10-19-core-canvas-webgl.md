# `?renderer=core` falls back to WebGL2

The bug was reported as "see-through shapes on WebGL2". A pixel readback of the core-gl canvas showed opaque fills at alpha 255. The real causes were not specific to GL:

- **Dots over frames.** The pixi canvas, which draws the dot grid, is a later sibling of the core canvas, so it painted above it. WebGPU core had the same problem. Now, while core is on, pixi hides its grid (`GpuScene.placeGrid`) and the core canvas paints the dots as its own CSS background (`dotBackground`), under its pixels.
- **Frames losing images.** `media.ready` swallowed failed loads. A card or frame whose picture 404'd was still claimed by the core, so pixi hid its cached snapshot and the core drew it empty. `ready` now returns `Readiness`, and CoreFrames claims only `Whole` lists.
- **GL only.** A picture larger than vello_hybrid's 4096 atlas panics (`unwrap` in `upload_image`) and poisons the module. Every ~3.5k image also took a whole 64 MB atlas page. GL pictures are now shrunk to 2048 per side before upload. A canvas that refuses WebGL2 throws instead of panicking.

CoreFrames now tries `createCore` and then `createCoreGl` before it falls back to the old canvas.

Tried and discarded: scoping image clips per frame (no visible effect on the fixture).
