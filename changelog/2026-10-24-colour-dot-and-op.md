# Colour dot on GPU nodes and set_node_color

F4 FL-17 follow-up. `tileChrome` draws a dot at the right end of the label row when the tile has a `tag` (hex); `CardTile.tag` is part of `cardKey`. `GpuFlow` reads it from `data.colorTag`.

- MCP/edit op `set_node_color {nodeId, color|null}` (canvas-ops), same write path as `update_node`. Tool pins updated on purpose.
- Not done: undo.
