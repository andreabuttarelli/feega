# Undo after rejecting an agent move

Rejecting an agent change that only moved a node returned no undo item:
`writeEdited` skipped the item when `data` was unchanged, and a server
`UndoItem` cannot carry a position. The client pushed nothing, so the
first Cmd+Z undid an older gesture and the reject stayed.

`rejectChange` now also returns `moves` (before/after per node). The
canvas pushes them as a client move gesture, the same one a drag makes.
Rejected: encoding position in `UndoItem` (moves are last-write-wins,
not versioned events).
