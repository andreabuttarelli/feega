# Frame worker: doc text written once per doc

`frameBuilder` keeps each doc's JSON text in a `WeakMap`: rebuilding a frame at a sharper asset
tier no longer re-stringifies a doc of several MB on the main thread.

Discarded:
- Loading the default faces at worker start. The load bench showed 1x cold opens ~0.5 s slower
  (the warm-up held the worker while the first frame waited); after the first build the faces
  are already loaded, so there is nothing left to warm.
- Handing the worker the raw response text. The batch carries every frame in one body, and
  CoreFrames rewrites the assets per tier before building, so no per-frame text exists to pass
  without moving the batch fetch and tiering into the worker.
