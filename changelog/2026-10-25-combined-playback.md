# Combined videos play every scene on the canvas

Playing a combined frame on the canvas showed only the scene drawn before play.
Each playhead tick rebuilt the parent through `withScenes`, which refetched every
scene doc not open as a live doc. A fetch takes longer than a tick, so every
rebuild was superseded by the next generation and none landed. Scrubbing worked
because the last rebuild finished once the playhead stopped.

`loadOnce` in `scene-sources.ts` memoizes fetched scenes; `CoreFrames` keeps one
per scene stamp, so a saved scene edit (new stamp) fetches again. Live-held
scenes still read the live doc. The model (clip offsets, local time, flatten)
was already correct; export resolves once and was not affected.

Guard: `tests/e2e/canvas-scenes-scrub.spec.ts` (product-launch scenes, scrub and
play, corner colour per scene).
