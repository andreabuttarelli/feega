# Long provider jobs get their own timeout

`expireStuckRuns` (the run tick) expired every `node_runs` row still `running` past
`RUN_STALE_MS` (6 min) — right for a synchronous generation (image, text: the HTTP request that
runs it dies with the request), wrong for an async provider job. ElevenLabs dubbing, Wiro tasks
(especially video) and queued video renders legitimately run for tens of minutes after the
request that started them has already returned; the sweep was closing them as `expired` while
the provider was still working.

- `JOB_TIMEOUTS_MS`: one table, keyed by `JobKind` (`sync` 6 min, `video` 20 min, `wiro_image`
  10 min, `wiro_video` 30 min, `dubbing` 60 min). `jobKindOf` reads the kind from
  `external_job_id`'s prefix (`elevenlabs:` → dubbing, `wiro:` → wiro_image/wiro_video, decided
  by the node's `type`; anything else with a job id → generic queued video; no job id → sync).
- `expireStuckRuns` now reads every `running` row (`runningRuns`, was `dueRuns` with a single
  age cutoff pushed to Postgres) and checks each row's age against its own kind's cap in JS.
  `dueRuns` had no other caller — removed.
- An async job is never expired for age alone below its cap: the age check happens before the
  claim, so a job still within its window is left untouched, exactly like today's loop-ticket
  exemption. When a job does cross its cap it is `claimRun`ed and closed exactly as before —
  `expired`, node `running: false`, same refund path (no billing happens until a reconciler
  reads a `done`/`failed` verdict from the provider, so an expired async job never bills).

Tests first (`generate.test.ts`): dubbing at 20 min survives, sync run at 7 min expires, wiro
video at 25 min survives (and expires past 30 min), wiro image expires past 10 min, a generic
queued video (no wiro/elevenlabs prefix) survives under the 20 min video cap.
