# Local mode saves off the main thread, and parses every frame at start

A cold open of the 36-page stress canvas in local mode left the outer half white for 10–15 s. A
server CPU profile put the tail on the save, not on parsing: `snapshot` → `packFeega` held the only
thread 3–6 s per save (fflate deflating ~300 MB of PNG/JPEG/WebP that do not compress, `idsIn`
running a UUID regex over an 86 MB `JSON.stringify` of the heads, then a second stringify in the
pack). Opening an unchanged file still writes: the style sync at rest commits once when a frame's
styles differ from the library (one frame on stress36), and the client uploads a poster for every
frame drawn without one. Each write scheduled a save 300 ms later, and no request was answered for
the length of it: in one run nothing finished between 4.4 s and 10.7 s.

- `feega-packer.ts` + `feega-pack-worker.cjs` (a `worker_threads` worker, source inlined with
  `?raw` so the node build needs no extra entry): the main thread builds the body string with each
  frame doc stringified once per doc object (`WeakMap`; memory-db replaces docs, never edits them),
  posts it with the asset rows and their bytes; the worker scans ids, deflates the two JSON entries
  with `zlib`, writes media **stored**, `fsync`s `<file>.saving` and replies; the main thread
  `renameSync`s it over the file. CRCs of unchanged media are kept by bytes identity.
- Durability is unchanged in kind: temp file + rename, never a half-written `.feega`; the worker
  adds an `fsync` the old path lacked. The loss window on a crash was 300 ms debounce + one save
  (3–6 s on stress36); it is 300 ms + at most one save in flight + the next (~1–2 s each, off the
  main thread). `flushNow` on exit stops the worker (a reply after that is discarded, its temp file
  removed) and writes synchronously as before.
- Saves chain one behind the other and each takes the state at its start, so writes made during a
  save become one more save, not one each: at most one snapshot exists at a time (the body string
  and a copy of the media bytes in the worker while it writes), whatever the edit rate. A failed
  save logs and leaves the file dirty.
- A process killed without `flushNow` (SIGKILL) leaves the last complete file and possibly a
  `<file>.saving`; opening the file removes it.
- `packFeega` stores media too: a file the new code writes opens in the current release (same fflate
  reader; stored entries are plain zip), and old files open unchanged.
- `warmHeads` parses every head of the file one per event-loop turn at local start and widens the
  per-revision cache to hold them all (local mode already holds every raw doc in memory; the cap is
  by count, not bytes). Hosted is untouched: no caller warms there.

Rejected: fflate's async `zip` (it still spent ~0.7 s on the main thread), deflating media at level
1, and moving parse to a worker pool (the parsed doc must come back by structured clone, about the
cost of the `cloneDoc` it would save; warming at start removes it from the open instead).
The body string keeps `events` (canvas history) and any later key: only `heads` is assembled by hand.
