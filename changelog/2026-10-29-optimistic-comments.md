# Comments run through the optimistic runner

Add, reply, edit, delete and resolve used to `await post(...)` and then reload the whole thread
list: 480–570 ms on the test account before the panel changed, longer on a slow line.

Now each is a row in `src/lib/canvas/comment-ops.ts` (local apply, server fields, the thread it
touches, notice) run by `createOptimistic`. The client picks the comment id; `addComment`
stores it (`id`, validated as a uuid), so the thread on screen is the stored one and no id
reconciliation is needed. A refusal restores only the touched thread. While an op is in
flight a focus-triggered reload keeps the teammates but leaves the threads alone; the runner
reloads once idle.

`createOptimistic` gained a type parameter for what an op touches: canvas ops touch
nodes/edges, comment ops touch thread ids. Comments reserve no undo slot (they had none).

Also: `canvas-groups` first case looked for the removed `motion-editor` testid; it now checks
that a double-click selects a child clip (`frame-selection`).

| Action | Before | After (server delayed 2 s) |
|---|---|---|
| Add comment | 499 ms | 12 ms (1 frame) |
| Reply | 566 ms | 12 ms |
| Edit | 549 ms | 17 ms |
| Delete | 480 ms | 12 ms |
| Resolve | 532 ms | 13 ms |
