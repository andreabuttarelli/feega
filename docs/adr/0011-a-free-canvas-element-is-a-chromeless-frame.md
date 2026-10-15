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
opened. Groups: see below.

## Groups (amended 2026-10-15)

A canvas group is a frame of kind `group`. It holds two things:

- **Free elements**, drawn inside its doc as clips, so they render, scale and edit with the group.
- **Any other node** (frames, generation nodes) as a member: `data.groupId` on the member names
  the group. A member stays its own node, so a frame in a group still opens, plays and edits.
  The group sits behind its members (`z = -1`), so they keep taking clicks.

Every node may carry `data.rotation` (degrees, -180..180), applied as the CSS `rotate` property
on the node wrapper; `rotation` and `groupId` are layout fields shared by all node types
(`nodeLayoutSchema`, `node-layout.ts`), validated alongside each type's own schema. No column,
no migration.

Rotating a group turns it and moves every member around the group centre, adding the angle to
each (`rotateGroup`); moving a group moves its members by the same delta (`translateGroup`).
Discarded: SvelteFlow parent nodes (`parentId`) — positions become relative to the parent, so
every reader of `nodes.x/y` (MCP, agent, posters, LOD) would need to resolve the parent chain.
Not done: scaling a group with members (only its own clips scale), rotation undo.
