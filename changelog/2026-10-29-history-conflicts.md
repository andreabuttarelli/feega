# Refused writes are recorded and resolvable (#1550)

Before: a write refused by optimistic concurrency returned `conflict` to the caller and was lost.
Now it lands in `canvas_conflicts` (refused data, expected and actual version, refused actor,
winning `canvas_events` id):

- `writeNodeData` stale `nodes.version` -> `attempt = replace`;
- `patchNodeData` clashing list keys -> `attempt = patch`, `expected_version` null (the caller
  sent a base, not a version). Internal retries inside `patchNodeData` are not refusals and are
  not recorded;
- `appendRevision` stale motion head -> `attempt = motion_head`, `attempted = {doc}`, no winning
  event (the winner is a revision).

History reads the table as a fourth source (`conflict.open` / `conflict.resolved`). Keep mine
re-applies `attempted` on the current version (replace, merge or new revision); keep theirs only
closes the row. Closing is guarded by `resolved_at is null`.

Paths: panel POST `/p/{p}/c/{c}/history`; `POST /api/v1/canvas/{c}/conflicts/{id}/resolve` ->
canvas op `resolve_conflict` (MCP through `edit`); CLI `feega resolve-conflict`. The spec's
`feega history resolve` was not used: `history <canvasId>` already takes a positional.

Migration `20261029160000_canvas_conflicts.sql` is not applied by deploys. Until it is, every
read and write on the table degrades to empty/no-op (`42P01`/`PGRST205`).

Not done: the concurrent-edit window (two authors on one node within N seconds) — still gap 4
in the spec.
