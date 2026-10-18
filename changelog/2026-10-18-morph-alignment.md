# Morph alignment without allocations

Profiling the inline editor open on the heavy canvas (Chrome, prod build): the hottest JS was
`aligned` in `src/lib/motion/shape/morph.ts`, 344 ms self time in 2.5 s of open + playback. It
built 240 rotated copies of a 120-point ring every frame for every morphing shape.

Now the cost is computed on flat `Float64Array`s with an index offset; only the winning rotation
is materialised. 0.40 → 0.09 ms per morph frame (`morph-cost.test.ts`, budget 0.2 ms); in the
profile 344 → 206 ms over the same window.

Discarded: caching the alignment per outline pair — `shapeLayers` rebuilds outlines each frame,
so identity keys never hit and a content key costs about as much as the work.
