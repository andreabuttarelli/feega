# Heavy canvas perf fixture

The landings bench needs network imports and the real heavy canvas is user data. `heavy-fixture.mjs`
generates a deterministic stand-in (tall pages with breakpoint views, posts, slides, mixed effects,
raster images) and `BENCH_CASE=heavy` runs the landings gestures on it. Landings behaviour unchanged.
