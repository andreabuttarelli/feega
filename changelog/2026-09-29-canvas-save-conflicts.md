# Canvas saves survive concurrent updates, and say why they fail

Before: `refresh()` threw the whole snapshot away while any save was in
flight, so a node updated by a generation or another client kept its old
`version` locally; the next edit got a 409 and the page showed "non salvato"
for that and every other failure.

Now:
- a dropped snapshot still adopts the fresh row of every node with no save
  queued (`adoptIdleRows`, `createWriteQueue().busy`);
- a 409 rereads the row, reapplies the user's patch on top and retries once
  (`writeWithRetry`); only a second conflict is reported, and the edit stays
  on screen;
- every failure maps to one English message from one table
  (`SaveFailure` → `saveMessage` in `node-save.ts`), and the raw answer goes
  to `console.warn`.

Discarded: advancing only the version without the data (the next write would
overwrite the generation's output with stale local data).
