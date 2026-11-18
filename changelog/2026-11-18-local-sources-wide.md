# Local cold open: frame sources answered from start, asked wide

On a 36-page local canvas the one Node thread was ~100% busy while the browser asked for frame
sources two at a time: per two-frame ask 60–270 ms of linking, asset-id scans, `JSON.stringify` of
1–7 MB docs, sha1 and sync brotli; and each ask waited 0.3–1.2 s for one of six HTTP/1.1
connections held mostly by fonts.

- Local mode sends sources plain (`revalidated`): compressing on loopback only spent the thread.
- `warmSources` (after `warmHeads`, at server start) links every frame, scans its asset ids and
  writes its doc JSON once; the route splices the memoised JSON (`sourcesJson`). Per ask: 20–50 ms.
  Relies on `linkedMains` returning the same doc for the same homes.
- Local asks: first ask two nearest frames, then six per ask, two open (was two per ask). Fewer
  rounds of waiting for a socket.
- Local mode keeps no IndexedDB copy of sources: the server answers from memory, and the copy cost
  ~0.35 s of main thread (a `JSON.stringify` per source just to size it).

Measured (stress36, 5+5 alternating): see the PR. Tried and dropped, no measured gain: deferring
the style-library sync and the live text measure until every frame shows; fonts fetched once per
canvas through the main thread (`perf/fonts-once`) cost the first frame ~0.4 s.
