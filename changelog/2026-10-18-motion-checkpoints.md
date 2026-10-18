# Motion revisions are checkpoints

Every motion edit was its own `motion_revisions` row: an agent stream of 100 tool calls wrote
100 rows, and the editor (250 ms save debounce) wrote one per drag pause or typing pause.

Now writes go through `commit_motion_revision` (migration `20261018120000_motion_checkpoints.sql`,
**to apply by hand**). It locks the head and:

- refuses when the head is not the expected version (null → `Conflict`) — needed because folded
  versions leave gaps, so "insert expected+1 and rely on the unique key" no longer detects a
  stale writer;
- with `Checkpoint.Coalesce`, folds the edit into the head when the head is by the same actor
  (kind, id, agent key), not `sealed`, and last edited less than `CHECKPOINT_IDLE_MS` (3 s) ago:
  the row moves to `expected+1`, `created_at` becomes the last-edit time;
- otherwise inserts a new row.

Version numbers still move on every edit, so expected-version conflicts, rebases in `commitOps`
and realtime `docHeadRevision` patches behave as before. A new revision is cut on idle, on actor
change, and for every `Checkpoint.Cut` writer (the default: restore, undo, templates, moves,
compose, chat turns). Coalescing callers: `tool-run` (MCP/API tools, batch) and the editor's
`apply_ops` / `save_doc` — the UI save path needed no client change.

Naming a version seals it (`sealRevision`), so the next edit does not fold into it.
`render-link` reads with `readCheckpoint`: a render asked for a version that got folded renders
the checkpoint that absorbed it instead of failing.

Before the migration is applied the RPC is missing (`PGRST202`) and writes fall back to the old
plain insert: nothing breaks, nothing coalesces. `fakeDb` answers `PGRST202` to every `rpc`.
