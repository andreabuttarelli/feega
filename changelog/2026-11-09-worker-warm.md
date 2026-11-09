# Frame worker: default faces at start, doc text once

- The frame worker loads the default faces (DM Sans, Fragment Mono via `BUILTIN_FONTS_URL`) as
  soon as it starts, so the first build does not wait on that fetch and parse.
- `frameBuilder` keeps each doc's JSON text in a `WeakMap`: rebuilding a frame at a sharper asset
  tier no longer re-stringifies a doc of several MB on the main thread.

Discarded: handing the worker the raw response text. The batch carries every frame in one body,
and CoreFrames rewrites the assets per tier before building, so no per-frame text exists to pass
without moving the batch fetch and tiering into the worker. Warming the fonts a batch references
before its frames reach the worker needs the same move.
