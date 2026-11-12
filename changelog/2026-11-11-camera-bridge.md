# Canvas: a camera tick no longer walks every frame

A pan or zoom tick reran, in `CoreFrames.svelte`, everything that read `view`: the build and warm
queues (`toBuild`/`toWarm`, sorting every frame by distance), residency (`resident`), thumbs and
card ordering (`fillOrder`), the tier key of every frame (`reachOf` inside `keyOf`, which rebuilt
`framePuts`, `pictureBytes` over every item of every list, `cardIndex`, `standIndex`), and inside
the paint a full stage of the core: drop/put/upload loops, `worldUses` + `SentUses.patch` over
every frame. All of it O(frames) per tick.

Now the camera feeds one value, the **sight** (`src/lib/canvas/core/sight.ts`): the ids on screen
and within one screen of it, from the existing `SpatialIndex`, plus the camera it was taken at.
It changes only when that set changes. Work that needs the camera derives from `sight`, and the
paint stages the scene (`stage()`) only when the scene, the sight, the zoom cache step or a
pending upload asks for it; a camera-only paint is `setCamera` + `frame`. Cache textures during a
zoom are sized at the top of a quarter-octave step (`cacheZoom`), so the cached set is stable
within the step and never above budget. (`pictureBytes` per list is cached by #2005.)

Rejected: `untrack(() => view)` inside a `$derived` keyed on the sight still reran on a pan;
the camera now travels inside `sight`. Restricting the uses sent to the engine to the near set
was left out: the engine culls, and a smaller patch would trade per-tick work for per-sight work.

Measured with `tests/perf/camera-tick-bench.spec.ts` (gradual wheel pan and zoom at 120 Hz,
48 copies of real landing pages, headed Chrome, contended machine, scene still loading):
JS per frame pan 27.7 → 8.2 ms, zoom 17.2 → 11.5 ms; `pictureBytes`, `paintOn`, `resident`,
`fillOrder` leave the per-tick profile. What remains per tick on zoom is the chrome overlay
(`chrome.ts` contours rebuilt at every stroke step, `setOverlay` + JSON diff), in `GpuFlow`.
