# Local-first editing: the editor never waits for the network

**Before.** Every keystroke in a node, every Select index step and every inspector change
fired its own `write`; each response replaced the node's `data` with the server row and then
called a full `snapshot`; realtime echoed the same write back and triggered another
`snapshot`; every snapshot re-ran `estimate_text_cost`. On a 30-node canvas, typing 200
chars fired 374 requests (131 write, 131 snapshot, 111 estimate), kept only 28 of 206
expected chars in the field and in the database, and was still sending a minute later.
20 Select steps fired 248 requests.

**After.** Same Playwright run (dev server, real Supabase, disposable user): 200 chars →
5 requests (3 write), 206/206 chars in field and DB, idle 0.75 s after the last key;
20 Select steps → 3 requests, UI and DB agree. No long tasks; input latency p95 11 ms.

**How.**
- `src/lib/canvas/save-scheduler.ts`: per-node saves, 400 ms trailing debounce, 2 s max
  wait, one request in flight per node, newer edits merged into the next (latest wins per
  field), backoff retry on network/5xx, `flush` on focus out, selection change, page hide,
  navigation; `beforeunload` warns while something is unsent. Input handlers never await.
- `node-save.ts`: `adoptIdleRows`/`keepDirty`/`keepLocal` merge a server row but keep every
  field still dirty locally; `isOwnEcho` drops realtime updates this tab already holds or
  is sending. Other realtime changes refresh once per 250 ms, not per event. No refresh
  after own writes.
- A text node's cost estimate is not re-asked for the same prompt/model/revision.
- A "Saved / Saving… / Offline — retrying" status in the corner.

**Discarded.** Rewriting `CanvasFlow`'s node sync for finer re-renders: once the request
storm stopped, the measurement showed no long task during typing. Conflicts keep the
existing reread-and-reapply once (`writeWithRetry`). Multi-selection property edits go
through the same `write()` and scheduler; not measured separately.

`write-queue.ts` is gone: the scheduler owns per-node ordering.
