# Frame branches, steps 2–3: storage and editor ops

A branch is a motion node with `data.branchOf = { nodeId, baseVersion,
name }`, created next to its frame with a first revision equal to the
frame's head (`branch-store.ts`). No migration.

- `listNodes` leaves branch nodes out; `listBranchNodes` returns only
  them. Every canvas, export and agent listing goes through `listNodes`,
  so branches never show on the canvas; `findNode` still reads them, so
  the ordinary editor, ops, realtime and undo work on a branch.
- Use cases (`branches.ts`, behind the `BranchStore` port, tested in
  memory): create, list, review (conflicts from `branchDiff`), merge
  (`mergeBranch` committed on the frame through `commitDoc`, so a peer
  edit landing during review rebases), drop. Drop refuses a node that is
  not a branch, so it can never delete a frame.
- Editor ops (`editor-ops.ts`): `create_branch {name}`, `list_branches`,
  `review_branch`, `merge_branch {choices}`, `drop_branch` — the same
  table the editor page, `/api/v1` and MCP read.

The editor UI (branches menu, review panel) comes next.
