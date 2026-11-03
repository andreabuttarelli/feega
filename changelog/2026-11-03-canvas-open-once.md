# Canvas open: one source download per frame

Opening a canvas downloaded every frame's source twice: `CoreFrames` (via the build worker,
which fetched the URL itself) to draw, and `GpuFlow.fetchPickDoc` to pick. On an imported page
(1.4 MB doc) each copy costs ~1.1 s of server time (`readHead` + zod + linked mains + asset
signing) and 1.4 MB on the wire.

Now both go through `frameSources` (`src/lib/canvas/core/frame-sources.ts`): one fetch per
source URL, kept for the last 8 URLs, failures not kept. The worker no longer fetches: it gets
the source in the message.

Measured on a canvas with two imported pages + one frame (dev server): source requests 6 → 3,
bytes 6.1 MB → 3.0 MB.

Not done, found while profiling:
- `GET /api/v1/projects/:id/components` reads and zod-parses the head doc of every motion node
  in the project (24 docs, 25 MB on the test project): 5–6 s, and only `comps[].component` is
  used.
- `/source` zod-parses the head and every linked set doc on each request (~50–180 ms per
  1.2 MB doc).
