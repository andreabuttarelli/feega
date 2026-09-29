# Save only changed node fields

A canvas `write` sent the node's whole `data`. After a 409 the client reread
the row and re-sent `{ ...fresh, ...patch }`, but `patch` was often the whole
gen state (`changeGen` passes `genData(...)`), so `refId`/`runId`/`running`
written by a worker, a sync or another client were overwritten with stale
values. A burst test (user typing while a service-role writer changed
`refId`/`runId`) reproduced it.

## Now

- `src/lib/canvas/node-patch.ts` holds the merge rules in one table
  (`MERGE_RULES`): `params` and `filters` merge one level down, every other
  key and every array replaces, `null` removes a key. `diffNodeData`,
  `mergeNodeData`, `baseOf`, `clashingKeys` all read that table.
- The client sends `patch` (only keys the user changed against what the tile
  showed) and `base` (what the last server-confirmed data held at those keys;
  tiles now carry `saved`).
- `patchNodeData` (repo) reads the row, refuses only when a patched key moved
  underneath (`clashingKeys`), merges, validates the merged row, and writes
  with `where version = <read version>`, retrying the read-merge-write up to 5
  times. Version is no longer the conflict unit: disjoint writes both land,
  same-key writes are a 409 and the client reapplies on the fresh row as
  before.
- Workers use the same path with `DataCheck.None`: run closing/give-up/video
  reconcile/reaper (`showRunState`, which no longer rewrites
  `prompt`/`model`/`params`, so a prompt edited during a run survives),
  workflow `running`, apply-effects, the sync result.
- The project agent's `update_node` is now a patch (no `expectedVersion`).
- MCP `update_row` on `nodes.data` validated the merged row but wrote the raw
  patch, wiping every other key; it now writes the merged row per node with a
  version guard and reports `conflicts`.

## Discarded

- A Postgres jsonb deep-merge RPC: it would duplicate `MERGE_RULES` in SQL.
  The CAS loop keeps the table in one place and is atomic per attempt.
- `batchWrite`, `restore`, undo and loop list items still write full data
  under a version guard: they cannot clobber, only report a conflict.
