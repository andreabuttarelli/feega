# Live edits in a shared frame

Before: the editor saved whole docs with `?/save`; a second editor in the same frame got a 409,
a "Reloaded the latest version" banner and lost its edit. Remote writes were adopted only when
the agent made them, and replaced local unsaved work.

Now the editor sends `outgoing(base, present)` ops to `?/ops` (ADR 0007) and keeps the last
server revision as its base. A save that lands rebases what was typed meanwhile on the server's
doc (`landed`); a `nodes` row change from anyone fetches `?/head` and rebases the local doc on it
(`remote`). One save in flight at a time; a remote change seen during it is pulled right after.
Remote edits replace `history.present` without a history entry (per-user undo comes next).

Proof: `tests/e2e/frame-collab.spec.ts` (two users, two contexts; red on the old save path).
