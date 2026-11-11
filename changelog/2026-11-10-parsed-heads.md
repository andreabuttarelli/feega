# Frame heads: fetched and validated once per revision

`readHeads` fetched every head doc (MBs each) and ran it through `parseMotionDoc` (zod) on every
open. A revision is immutable, so the parsed head is now kept per `(org, node, version)` (32
entries) and only the missing ones are queried.

Landings fixture, local mode, sources route with all 6 frames: first byte 1030 ms → 686 ms on the
first call (with the mentions change), 840 ms → 114 ms on repeat calls.

The cached doc is shared between requests: callers must not mutate it (sources stringify it,
`linkedMains` returns new docs).
