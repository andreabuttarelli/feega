# A free canvas element is a node holding one clip

Context: graphic elements (Text, Box, Ellipse, Path, Image) lived only inside frames, as clips of
the frame's doc (`motion_revisions`). The product now wants them anywhere on the canvas: drawn
outside any frame, dragged out of a frame and back in, grouped with ⌘G. Next to them sit the AI
generation nodes, renamed "Generate text / image / video / audio / 3D model" so the two families
read apart; their type ids (`text`, `image`, …) do not change.

Decision: a free element is a canvas node of a new type, `element`, whose `data` is
`{ clip, size }` — one clip in the frame clip schema (props, fills, strokes, effects, radius,
text style, keyframes), plus the node's pixel size. Position is the node's `x`/`y`, as for every
node. A group is a node of type `element` whose clip is a `Group` holding child clips in the same
schema, so a group moves, scales and rotates as one node.

Why this, given the constraints:

- **One renderer, one inspector.** The clip is the frame clip, so the frame's compose path draws
  it (a one-clip doc sized to the node) and the frame inspector edits it. No second property UI.
- **Realtime and concurrency.** Each element is its own row: `version` guards `data` per element,
  position stays last-write-wins, two people editing two elements never conflict. Realtime already
  publishes `nodes`.
- **Drag out / in is a row move, not a doc rewrite of the whole canvas.** Out of a frame: the
  frame doc loses the clip (one revision), a node is created with that clip. Into a frame: the
  node's clip goes through `placeElement` (#512) and the node is soft-deleted. One undo item
  holds both writes, as `moveElement` already does between frames.
- **Performance.** An element is a node, so the LOD poster layer and the #597 shells apply as is;
  a static element posters like any other node.
- **MCP parity.** The existing node tools (create, update with `version`, delete, move) cover
  elements; group/ungroup and drag in/out are thin endpoints over the same functions the app calls.
- **Export.** Not required now. A single element is already a one-clip doc, so exporting it is the
  frame export with a doc built on the fly.

Discarded:

- **(b) An invisible canvas-level "board" doc.** Every element of the canvas in one doc: one
  `version` for all of them, so any two people editing any two elements conflict; the whole board
  re-renders as one unit, which defeats the per-node LOD; and every node tool would need a twin
  that edits the board instead.
- **Reusing the generation nodes** (`text`, `image`). They carry prompts, models and runs; a drawn
  Text is not a generation, and mixing the two is the confusion the rename removes.
- **One node per shape with its own schema** (Box node, Text node, …). It re-declares properties
  the clip already has and needs a second inspector.

Costs: `element` joins `NODE_TYPES` and the `nodes_type_check` constraint (one migration). A clip
on the canvas has no timeline: `from`/`durationInFrames` are kept so it can enter a frame as is,
and ignored while it is free. Keyframes survive a round trip but do not play on the canvas.
Groups hold elements; frames inside a group are out of scope until a frame can be a child clip.
