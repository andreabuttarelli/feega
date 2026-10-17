# Restoring a frame version merges with a peer's edit

`restoreRevision` wrote the old doc whole at `expectedVersion = head`: a
peer commit landing in between made it a conflict ("could not restore").
It now goes through `commitDoc` (diff head → old version, rebased on the
newest head, up to `COMMIT_ATTEMPTS`): the restore wins on every field it
changes, and a peer's concurrent edit to another field survives.

`restoreRevision` moved to `motion/restore.ts` in a separate commit, since
`frame-ops` already imports `editor` and the other way round would be a
cycle.

Still whole-doc: template insert from the API (`template-api.ts`, no test
harness yet), `editor-ops` saves, `move-element`, canvas undo of a frame.
New-frame writes at version 0 (compose, remix) need no merge.
