# gpu-core: DOM reads never wait an animation frame

#1018 kept the iframe `requestAnimationFrame` wait for clips that contain a canvas. It is gone for
every clip: the Three.js and 2D canvas components paint synchronously inside the exact seek, so
the wait only cost a vsync. Frames read with and without it are byte-identical on motion-webgl,
asteroids, saturn (Three.js), generative and supasito (`cmp` of the parity frames).

Real editor (`/p/.../motion/<node>?engine=gpu-core`, test account, 5 s playhead sweep, fresh dev
server per run, runs interleaved before/after x3), generative doc, canvas presents per second:

| | run 1 | run 2 | run 3 |
|---|---|---|---|
| before | 3.6 | 3.8 | 4.0 |
| after | 10.0 | 15.6 | 17.6 |

Still short of 60: a read round trip is ~14 ms steady but has 250-600 ms spikes (iframe tasks are
not long; the host is idle), so the core redraws ~14 times a second on Custom/3D docs.

Tried and dropped: deferring the hidden HTML player's seek until the scrub settles (no change in
draws/s, 3 vs 3 interleaved runs); a workgroup-tiled blur in `filter_passes.rs` (14.7 ms vs 11.5 ms
per asteroids frame, slower); layer caching does not apply to scrubbing (moving layers change every
frame). Layer cost in the core is GPU compute: asteroids = 5 blurred layers at ~1.5 ms paint + two
~2 ms blur passes each (`packages/gpu-core/examples/frame_cost.rs`).

Tools added: `scripts/bench/editor-scrub.ts` (real editor sweep: seeds a motion node into the test
account through RLS, deletes it after), `scripts/bench/dump-list.ts`, `frame_cost` example.
