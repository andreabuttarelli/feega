# A free canvas element is a chromeless frame

Context: graphic elements (Text, Box, Ellipse, Path, Image) lived only inside frames, as clips of
the frame's doc (`motion_revisions`). The product now wants them anywhere on the canvas: drawn
outside any frame, dragged out of a frame and back in, grouped with ⌘G. Next to them sit the AI
generation nodes, renamed "Generate text / image / video / audio / 3D model" so the two families
read apart; their type ids (`text`, `image`, …) do not change.

Decision: a free element is a frame node (`type: 'motion'`) with `data.kind: 'element'`. Its doc
is a transparent still sized to the drawn box, holding the element as its clip; the node is the
box itself. `kind` decides the chrome, in one table (`frameChrome`, `motion-node.ts`): an element
has no play bar, no Open editor, no name tag, no ports, and posters as PNG so it stays
see-through. A group of free elements is the same thing with several clips.

The first draft of this ADR chose a new node type `element` holding one clip in `nodes.data`. It
was dropped before any code because the chromeless frame already has everything that draft would
have rebuilt:

- **One renderer, one inspector, for real.** The element is drawn by the frame compose path and
  edited by the frame editor and its Properties. Nothing renders or edits a clip outside a doc.
- **Drag out already lands this way.** `moveElement` dropping on the canvas creates a frame
  holding the clip at its size (`frameOf`); a free element is that frame without chrome. Drag in
  is `moveElement` from the element's frame into the target, and the emptied element goes.
- **Realtime and concurrency.** Each element is its own row and its own revision line: `version`
  guards each doc, position is last-write-wins, two people on two elements never conflict.
- **Performance.** An element is a node with a poster, so the LOD poster layer and the #597
  shells apply as they are. Only an element being edited mounts a live player.
- **MCP parity.** `draw_element` is one more canvas op over the same `drawElement` the page
  action calls; moves, deletes and undo are the node and frame ops that exist.
- **No migration.** `motion` is already in `nodes_type_check`; `kind` is a field of `data`.

Discarded:

- **A node type `element` with the clip in `data`.** It needs a renderer for a clip outside a
  doc, an inspector bound to node data instead of the doc history, its own undo, and a migration
  on `nodes_type_check` — a second copy of what frames already do.
- **An invisible canvas-level "board" doc.** One `version` for every element of the canvas, so
  any two editors conflict; the whole board renders as one unit, which defeats per-node LOD.
- **Reusing the generation nodes** (`text`, `image`). They carry prompts, models and runs; a drawn
  Text is not a generation.

Costs: every element carries a doc and a revision history — heavier than a row of `data`, cheap
next to a second renderer. A poster is a raster: zoomed far in, an element is soft until it is
opened. Frames inside a group are out of scope until a frame can be a child clip.
