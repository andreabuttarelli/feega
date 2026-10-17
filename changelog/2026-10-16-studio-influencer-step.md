# Photo studio: influencer step, parallel batch

**Influencer step.** Models were a names-only chip row inside "More options" of the
Style step, filtered to allowed ones (so usually "None yet"). Now a dedicated step
between Photo and Style (`Step.Influencer`) shows `InfluencerPicker`: cover + name for
every influencer `studioOptions` returns (catalogue + org's own), allowed first,
disallowed disabled with `MODEL_VERDICT_TEXT`, multi-select, Skip, link to create.
No server change: the load already returned covers and verdicts.

**Parallel batch.** 12 photos took 15→144 s each. Causes:
- `cellKey` was environment+shot+model, so all products and variations of a cell
  shared one image node; `pickRunnable` never runs two items on one node (the node
  write is optimistic on `version`), so a cell was strictly serial.
- `ORG_PARALLELISM` was 4, and `drainStudio` claimed once and waited for the whole
  wave.

Now each photo is its own cell (product + variation in the key), the cap is 8 per org,
and `drainStudio` is a pool: it refills a slot as soon as one finishes, within a
240 s budget (route `maxDuration` 300). Test: 12 jobs × 1 s fake provider finish in
~2.0 s. Photos already appear live through `watchBatch` (realtime on
`product_batch_items`).

**Retry.** `afterFailure` requeues any non-moderation failure once with no delay, so
the same drain retries it; transient errors keep the 30/60 s backoff.

Discarded: parallel runs on a shared node (would break `version` concurrency).
