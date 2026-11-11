# Perf: count a frame's image bytes once per display list

Profiling a 4 s pan on the landings fixture (CDP sampling profiler, uncapped frames): `pictureBytes`
ran from `CoreFrames`' `framePuts` derived every frame, walking every item of every frame's
display list — 238 ms of 4.2 s main-thread time (~6%), the largest JS-side cost of the pan.

Display lists are immutable once built, so the sum is cached in a `WeakMap` keyed by the items
array: a new list recomputes, a dropped one is collected. The test counts reads of `kind` to prove
the second call does not walk the list.

## Frame marks once per group

On the heavy canvas pan, `performance.mark` from `markFrame` cost 121 ms of 4.2 s, and marks were
never cleared: the timeline grew for the whole session. Presentation steps (`put`, `patched`,
`pictured`, `drawn`, `thumb`) are keyed by a versioned group, so a repeat says nothing new; they
are now marked once per group. Request steps (`asked`, `built`, …) still mark every time: the
gesture bench counts them to catch rebuilds.
