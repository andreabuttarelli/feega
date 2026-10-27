# align_nodes, distribute_nodes, tidy_nodes, stack_nodes, undo_last

Before: Align, Tidy up and Stack existed only as canvas buttons; the parity table pointed them at
`move_node`, so an agent had to recompute every position. Undo was only the client stack
(`undo_gesture`, which needs the recorded items).

- Four canvas ops call the same pure functions as the buttons (`alignTiles`, `tidyTiles`,
  `stackTiles`) plus new `distributeTiles`. `arrangeNodes` loads the nodes of one canvas, sizes the
  ones with no stored size by type, writes each move with `moveNode`. Ids not on the canvas come
  back in `missing`.
- `undo_last` reads `canvas_events`, takes the newest events written by the same actor
  (kind, id, agent key), groups those within 1.5 s of the newest and replays their inverse through
  `undoGesture`: same stale checks as the app.
- Not undoable by `undo_last`: moves, resizes. `canvas_events` never records them (one row per
  frame would drown the log), so align/tidy/stack are reverted with `move_node`. Discarded:
  logging moves just for this.
- Calling `undo_last` twice undoes the undo: the undo is itself a write by the same actor.
