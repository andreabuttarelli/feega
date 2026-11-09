# Frames fill in together on open

**Measured** (per-frame marks `frame|<step>|<group>` from
`src/lib/canvas/core/frame-timeline.ts`, printed as a waterfall by
`BENCH_CASE=load`, landings fixture, CPU 4x cold): sources at ~2.9 s, worker
builds 3.4–4.7 s in parallel, all images ready together at ~5.7 s. Then the
frames went on screen one by one, 6.1 → 9.5 s:

- picture upload: `upload(list, pictures, 1)` sent one picture band per frame
  per animation frame, at most 4 frames; a frame with many images waited
  up to 2 s after its group was on the GPU;
- group upload: a fixed item count per animation frame, frame after frame.

`load()` also held an `IN_FLIGHT` slot until every image decoded, and showed
nothing before.

**Now:**
- `uploadWithin` (`picture-uploads.ts`): pictures go round-robin over every
  waiting frame within 8 ms per animation frame; a gesture keeps the old
  single pass.
- group puts continue past the item budget while 8 ms remain.
- `showStaged`: vectors show first under `<key>:vectors`, the whole list lands
  on `<key>`; a shown thumbnail stays until images are ready; the slot frees
  after the build.

**Still serial:** `put_group` encode on the main thread (~0.5 s per landing
frame at 4x). The vectors stage is often replaced before its put finishes on
heavy frames. Moving the encode off the main thread belongs to the gpu-core
work, not here. `IN_FLIGHT` is not the limit: all six frames ask at once.
