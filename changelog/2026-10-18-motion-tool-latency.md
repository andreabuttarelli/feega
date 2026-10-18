# Motion tool ops: fewer round-trips per call

One `POST /api/v1/motion/:node/tools` took ~14 sequential database/auth round-trips and a
moderation call on every op. Measured locally against production (laptop → Supabase, ~60 ms RTT),
`set_work_area` p50 918 ms → 397 ms, batch of 100 925 ms → 367 ms.

What went:

- **Moderation of structure.** The whole input was `JSON.stringify`-ed and screened, so an op made
  only of numbers still cost a classifier call. Now only string leaves are screened, minus keys
  named `id`/`*_id`/`*_ids`; an op with no text skips the review. A batch screens all its text in
  one call, before any op runs.
- **Re-reading the head at commit.** `commitDoc` writes on the base it holds; it reads the head
  and rebases only after a conflict.
- **Sequential loads.** `savedMotionWith` reads node and head together, then project and assets
  together. Brand tokens load only when a frame or still is drawn.
- **Node re-read on patch.** `patchNodeData` takes `known` (the record the caller already read) for
  its first attempt; a stale version still falls back to a fresh read.
- **Uncensored lookup.** `hiddenFor` reads the lock and the uncensored projects together.
- **Auth per call.** `resolveJwt` keeps `getUser` + memberships for 5 s per token
  (`CALLER_BURST_MS`), so a burst of calls pays it once. A refused token is never kept. Cost: a
  revoked session or role change can take up to 5 s to bite.

Still one revision per op: coalescing into checkpoints is the next change.
