# Higgsfield runs queue at the account's concurrency cap

Higgsfield limits simultaneous requests per account (docs example: 4) and
answers over the limit with `400 Maximum number of concurrent requests`. That
reply failed the run and the user saw an error for a request that only had to
wait.

- `TaskRunDeps.load` counts live runs of a provider across orgs
  (`providerLoad`, service role declared in `service-role-uses.ts`); the cap is
  `TASK_PROVIDERS.higgsfield.maxInFlight` (4), overridden by
  `HIGGSFIELD_MAX_CONCURRENCY` to match the console.
- At the cap, `startTaskRun` returns `waiting` and the run is stored with
  `external_job_id = higgsfield:waiting`. The node stays running.
- `reconcileTaskNodeRuns` resubmits waiting runs oldest first, recomputing the
  upstream inputs (fresh signed URLs). A new run queues behind waiting ones
  (`QueuePlace`), so a click never jumps the line.
- A 400 that still slips through (another client on the same key) is a
  `ProviderBusyError`: waiting, not billed, not failed.
- Discarded: an in-memory semaphore (serverless instances share nothing) and a
  new table (node_runs already holds every live request).
