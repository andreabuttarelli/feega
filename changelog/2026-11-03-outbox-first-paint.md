# Kept changes show from the first frame after a reload; ⌘Z on a queued draw

Durability audit round 3 (`~/Documents/feega-videos/audit/round3/durability/`).

- **Moves after an offline reload.** The move landed in the database but the canvas kept the
  old position until a later refresh. Two causes. (1) Placements replayed from the outbox were
  scheduled without a stamp, so a snapshot asked while the replayed move was in flight (the
  draft replay asks one) found it neither dirty nor `placedAfter` and took the server's old
  box. `restore` now stamps like `move`. (2) The outbox opened in an `$effect` that read
  `data.session`: every layout invalidation (`CANVAS_LIST_DEPENDENCY`) re-ran it, re-read
  IndexedDB and replayed the same drafts, draws and placements again, and left replayed
  drafts in the log, so the status stayed "Saving…" with nothing to send. The effect now keys
  on `outboxKey(user, canvas)` and opens once per canvas.
- **First paint.** The outbox is read in the canvas `+page.ts` load, in parallel with the
  page data (`openCanvasOutbox`), and the initial tiles already carry the unsent placements.
  `openCanvas` overlays unsent placements on every load, so a load that raced a landing move
  never shows the older box.
- **⌘Z on a draw still queued.** The undo slot of a draw waited for the server answer, so
  offline ⌘Z did nothing until the connection came back. A draw now pushes a `draw` entry at
  once; undoing it takes the op back from the queue (`takeBack`, refused only while the op is
  in flight) and removes the ghost; redo queues it again. A draw already sent undoes through
  the server as before.
- **Spec on the test account.** `npm run test:offline` runs
  `tests/e2e/canvas-offline-kept.spec.ts` against production as `test@dazero.co`
  (`E2E_TEST_EMAIL`/`E2E_TEST_PASSWORD`): the harness makes a throwaway project in that
  account's org, never an org or a user, and drops it after.
- **Discarded.** A time window ("placed in the last N seconds wins over a load"): it hides the
  race instead of naming the write.
