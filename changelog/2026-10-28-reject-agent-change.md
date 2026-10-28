# Reject one agent change

Customers asked to undo one agent edit without losing their own later
edits. Ctrl+Z walks only the tab's own stack, and `undo_last` refuses or
skips once the node moved on.

`rejectChange` (`src/lib/server/canvas/reject.ts`) reads the change's
`canvas_events` and those after it, then plans per kind:

- `node.update`: `mergeReject` (`src/lib/canvas/reject-plan.ts`, pure)
  three-way merges per path over `{data, position}`: a path still equal
  to the agent's value goes back; a path edited since is a conflict,
  resolved by `choices` (`mine` / `reject`). Nothing is written while a
  conflict is open. The write uses `writeNodeData` with the read version.
- `node.create`: soft delete, unless another actor connected or edited
  the node later; then `confirm` is required.
- `node.delete` / edges: restore / remove.

The reject is written as the user and returns `UndoItem`s, so Ctrl+Z
brings the agent change back.

Agent moves are now logged as `node.update` with `{position}` (people's
drags still are not), so a move can be rejected. `undo_last` ignores
them, as before.

Local mode: `canvas_events.id` is now a serial in the memory db, so
event order holds there.

Surfaces: canvas page panel (bot button, bottom right), page actions
`agent_changes` / `reject_change`, same-name canvas ops (MCP `edit`,
`feega canvas op`), `view activity` now returns event `id`.

Not done: rejecting a change also reverts nothing the agent wrote outside
`canvas_events` (motion doc revisions, sizes).
