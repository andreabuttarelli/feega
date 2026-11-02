# Imports queue for Browserless and never land an empty frame

Pre-release QA found two imports at once failing: one import opens two Browserless
sessions, the plan admits two, the next connect is refused with 429 and the import
answered 500. And an imported frame whose doc `parseMotionDoc` rejected landed empty
with a 200.

- `sessionSlots` (`web/browser-slots.ts`): one semaphore per server process, sized by
  `BROWSERLESS_MAX_SESSIONS` (default 2). `browserless()` takes a slot before it
  connects and frees it when the tab closes or the connect fails. Waiting is short
  (10 s); past it `BrowserBusy` is thrown.
- A 429/503 that outlasts the connect backoff is also `BrowserBusy`.
- `errorText` reads status and message from any refusal. The server bundle receives the
  refused connect as an `ErrorEvent`; `String(e)` made it `[object Object]`, so the 429
  was never recognised as retryable.
- `importPageAt` answers `busy` (503) for `BrowserBusy`. The dialog (`importPageWaiting`)
  shows "Browsers are busy, retrying…" and asks again, up to four more times, six
  seconds apart.
- `frameStore.create` checks the first revision. A rejected doc removes the node, logs
  the reason and throws `DocRejected`; `placeFigmaPlan` removes the frames of the same
  paste already created. The import answers `rejected` (422) with the reason as
  `detail`, shown in the dialog.

Discarded: a queue shared across deployments (needs a store, the plan limit is the
only thing it would protect); a long server-side wait (holds the request open past
the platform timeout).

Hold-and-wait: two imports can each hold one slot and wait for the other. The wait
timeout breaks it; the loser answers `busy` and the dialog retries.
