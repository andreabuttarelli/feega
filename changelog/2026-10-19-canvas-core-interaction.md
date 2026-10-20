# Canvas core: interaction and performance primitives

Phase 3 groundwork for `?renderer=core`, renderer-agnostic so the Rust engine and today's GPU canvas share them:

- `SpatialIndex` (1024-unit uniform grid): hit-test and culling in paint order. Replaces the linear `topNodeAt` scan in `GpuFlow` that ran on every pointermove.
- `Fling`/`Glide`: pan inertia from the last 80 ms of samples, friction decay.
- `FramePacer`: paint only on change, one rAF per frame however many invalidations; idle canvas requests none.
- `textured`: texture budget — only visible media holds a texture, largest on screen first; text/vectors cost zero.

Not yet measured: machine load was > 6 throughout. Perf harness core vs gpu still to come once the core renderer lands.
