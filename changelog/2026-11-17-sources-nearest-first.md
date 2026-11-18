# Frame sources two at a time, nearest first

On open, `frameSources.warm` sent every legible frame in one `/motion/sources` request (two in
practice, split by the frame cache's async lookups). On the 36-page stress canvas that was 19 and
17 frames, ~37 MB of JSON each, and every frame waited for its whole batch: the first six frames
were asked at 2.3 s and got their source at 12.3 s. The server cost is per frame (~115 ms of
`parseMotionDoc` on a cold revision, plus clone), so a batch cannot answer before all its frames
are parsed. In local mode the same Node thread also serves posters, fonts and pictures over six
HTTP/1.1 connections: posters requested at 8.1 s landed at 18 s, behind the batches.

`frameBatcher` now cuts the queue into asks of `framesPerAsk` frames, in the order they were warmed
(nearest first), with at most `open` asks in flight. The sizes are declared per mode in
`sourceAsksFor` (`src/lib/local-user.ts`): local 2 × 2, so four connections stay free for posters
and fonts and the server thread yields between frames; hosted 3 × 6, where separate instances
parse in parallel over h2 (12 invocations for 36 frames instead of 2).

Considered: one frame per request (fastest first answer, 36 invocations hosted); streaming the
batch as NDJSON (same first-frame latency, more moving parts); skipping zod on read (unsafe:
`upgradeDoc` and schema defaults change older rows).
