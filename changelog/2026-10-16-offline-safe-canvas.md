# Offline-safe canvas editing

Before: the save queue lived in memory (reload or crash = lost edits);
lines were one-shot posts rolled back on failure; the save state was a
text label and every failure a banner.

Now:
- `outbox.ts`: unsent node patches, placements and line ops are mirrored
  to IndexedDB per `userId:canvasId` (every access in try/catch, never
  awaited by the UI) and replayed on open: node patches through `write`,
  placements through `places.restore`, line ops through `lines.restore`.
- `op-queue.ts`: ordered, one-at-a-time line ops with client op ids,
  retried with backoff, dropped only when refused (notice + resync).
  connect carries a client-chosen line id; server answers idempotently.
  Motion-frame targets keep the old direct connect (frame link + undo).
- `keepLines`: resync keeps unsent new lines and hides unsent removals.
- `syncOf`: one 6 px dot (saved hidden / saving / retrying / offline)
  with the label as aria-label and title.
- Run and sync refuse offline with a notice; edits keep working.
- Undo/redo drain the queues first so a gesture never races its own
  unsent line.

Unsent edits are never broadcast: others see rows only once they land.
Not yet: real-stack offline e2e (next PR).
