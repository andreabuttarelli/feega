# Generation results and agent edits show without reload

Before: a finished text generation left the node empty until reload; typing in
the prompt while a run started could leave the node stuck on "running" in the
database or make the run fail with a conflict; edits, moves, soft deletes and
new nodes/edges written by the chat agent or an MCP agent often appeared only
after reload.

Causes, all found in a real browser (`tests/e2e/canvas.spec.ts`):

- The generated text is read from `node_runs` (`runsByNode`), and `refresh()`
  never adopted `snapshot.runs`: only `data.runs` from the first load.
- `changeGen` saved `genData` whole, so typing wrote `running`/`refId`/`error`
  back and marked them dirty; `keepLocal` then held the stale values.
- The prompt save landed before the run's version check → 409, run lost.
- `isOwnEcho` dropped every update on a node with a save in flight and every
  update at the same version (moves and soft deletes do not bump it).
- A save in flight superseded full refreshes, so inserts/edges were dropped.
- `syncNodes` never moved an existing node.

Now:

- `runsOverride` from every snapshot (`keepSame`), reset on canvas change.
- `SERVER_WRITTEN_FIELDS` (`node-data.ts`): never held by `keepLocal`,
  whatever the dirty keys; intended values of those keys come from the patch.
- `genPatch` writes only the changed keys.
- `saves.hold(id)` during the run POST; typed text is sent after.
- `isOwnEcho`: echo only if data, x, y, display name equal what the tab
  shows and the row is not deleted.
- `saveNode` no longer supersedes refreshes; `keepDirty` never moves a node
  to an older version instead.
- `syncNodes` takes the tile position unless SvelteFlow is dragging the node.

Not changed: the snapshot action still returns runs for every node, not only
the finished one. Node size set by an agent is not compared by `isOwnEcho`.
