# Frame sources: three round-trip waves instead of eight

`GET .../motion/sources` waited on eight serial database waves: memberships, then the canvas
once per org, then nodes, head versions, head docs, the asset library, its signing, named assets.
Against a remote Supabase every wave is a full round trip.

- The canvas is found with `openCanvasForUser` (memberships and canvas in parallel), not one
  query per org.
- Node rows and head revisions are read in parallel; the asset library is listed and signed in
  parallel with them, no longer after the docs arrive.
- The compressed body is kept per ETag (32 entries), so a reopen does not brotli the same MBs.
- `Server-Timing` names each phase: auth, canvas, heads, linked, assets, named, tokens,
  stringify, etag, compress.

Measured with an in-process bench (60 frames from `tests/e2e/fixtures/gpu-docs`, 200 assets,
40 ms per query, 7 runs, median): 537 ms → 319 ms. Guarded by
`sources.waves.server.test.ts`, which counts waves with fake timers.

Not done: `headVersions` reads every revision row of every frame to find the newest version; on
long histories that is thousands of rows and can hit PostgREST's row cap. Fixing it needs either
trusting `docHeadRevision` or an RPC.
