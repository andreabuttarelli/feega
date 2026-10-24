# Colour tags on nodes

F4 FL-17. `colorTag` lives in node data next to `rotation`/`groupId` (`node-layout.ts`, so any node type accepts it; `node-colour.ts` holds the palette).

- Selection bar: colour menu writes the tag to every selected node via `write`.
- Cmd+F: colour chips filter results; results show the dot.
- Not done: dot drawn on the node in the GPU core, undo, MCP op `set_node_color` (update_row on data.colorTag already works).
