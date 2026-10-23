# Rename canvas nodes

Frames and free items had no name path: `nodes.display_name` was only set at
creation. Now Layers renames a node row (double-click, Enter on a picked row),
and double-clicking the title above a tile on the canvas opens an input there.
Both call `renameNode` in the canvas page (`?/rename` action -> `renameOnCanvas`
-> `repos/canvas.renameNode`), last-write-wins like move/resize; empty gives the
default label back, max 60 (`cleanNodeName`). Agent parity: op `rename_node`
{nodeId, name}, mapped in `parity/ui-actions.ts`.

Not done: peers see the new name after their next read, not live (the realtime
tile mapper is not touched here).
