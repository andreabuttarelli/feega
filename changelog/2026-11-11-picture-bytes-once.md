# Perf: count a frame's image bytes once per display list

Profiling a 4 s pan on the landings fixture (CDP sampling profiler, uncapped frames): `pictureBytes`
ran from `CoreFrames`' `framePuts` derived every frame, walking every item of every frame's
display list — 238 ms of 4.2 s main-thread time (~6%), the largest JS-side cost of the pan.

Display lists are immutable once built, so the sum is cached in a `WeakMap` keyed by the items
array: a new list recomputes, a dropped one is collected. The test counts reads of `kind` to prove
the second call does not walk the list.
