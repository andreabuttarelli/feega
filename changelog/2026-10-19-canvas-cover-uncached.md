# Canvas frames appear before their texture is ready

**Why.** After the frame cache (#978) `Library::plan` drew nothing for a cached `use` whose
texture was still being rastered in chunks, or queued behind the one-raster-per-draw limit: the
frame stayed empty for several draws. Now it shows the partial texture built so far, or the frame background while queued. Drawing it expanded instead was tried and dropped: iPhone pan fell from 55 to 4 fps.

**Also found.** The picture budget handed to the widened reach starved on-screen frames on the
iPhone profile (`coveredMs` null); #983 already moved residency back to the screen, so this
change keeps that.

**Measured** (`scripts/bench/canvas-core.ts`, heavy copy, gpu then core): see the PR. The 7.5 s
Chrome figure was a cold dev server: with `BENCH_RENDERERS=core` alone the core run pays the
first compiles and `/source` responses; warm, dev covers in ~1.3 s.

**Discarded.** Putting group parts under an 8 ms per-frame budget instead of one part per
paint: pan fell to 4 fps on iPhone.
