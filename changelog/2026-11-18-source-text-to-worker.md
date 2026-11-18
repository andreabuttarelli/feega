# Frame docs go to the build worker as text

A 36-frame local cold open kept the page's main thread 70–100% busy while the build workers sat at
~25%. Part of it was pure copying: the page parsed each frame source (~1.15 MB) from the batch
JSON, then `JSON.stringify`'d it again only to post it to the build worker.

- `/motion/sources` now answers in lines (`sources-wire.ts`): a head (tokens, signed links), then
  per frame a small meta line and the doc text. The page parses the meta only. The head carries
  `format: "frame-lines/1"`: a batch without it (an older server during a rollout or rollback) is
  read as no batch and the page asks frame by frame, as it already did for a frame left out. A page
  from an older deploy fails `res.json()` on the lines and falls back the same way.
- `textFrame` (`text-frame.ts`) keeps the doc text and parses it the first time something reads
  `.doc`; `frameText` hands the worker the text without touching the doc; `withAssets` keeps it
  lazy through the picture tiers.
- After a frame builds, the hand-over to picking/live edit (which reads the doc) waits for an idle
  slice; the duplicate hand-over before the build is gone.
- The browser (IndexedDB) copy of each source is written in an idle slice: on `dev` it is kept in
  local mode too, and writing it on arrival spread the frame (parsing the doc) and stringified it
  to measure it, undoing the lazy doc.

Measured on the bench stack under #2337 (plain local sources, sources prepared at start, wide
asks, no IndexedDB copy in local mode — none of them part of this change), stress36, 5 alternating
cold runs per arm: all on-screen vectors 7.2 s → 5.5–5.7 s,
6th frame 4.3 s → 2.9–3.0 s, first frame back to the reference (the wide asks' ~150 ms penalty
is gone). Main-thread busy in 0–8 s did not drop: the work moved later, it was not removed.

Tried on top and dropped (vectors later in 4/5 rounds although main-thread busy fell ~1.2 s):
building a frame picker only for a hovered layer, handing sources over in idle batches, and
preparing live-edit measures after the frames show (`perf/source-text-extras`). Less font work
on the page delayed the fonts the workers wait on (last font request 8 s → 12.5 s).
