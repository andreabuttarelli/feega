# Move elements between frames, and feed generative nodes into a Frame

Frames (motion/still docs) hold graphic elements; Text, Image and Video nodes generate. Before,
an element could not leave its frame, a generated output could not enter one, and a Frame had no
input ports at all (`node-ports.ts`: motion inputs NONE).

**One op, every surface.** `src/lib/motion/move-element.ts` is pure doc work: `liftElement`,
`placeElement`, `frameOf`, `mediaElement`, `linkOutput`. `src/lib/server/motion/move-element.ts`
runs it on revisions through a `FrameStore` port (`frameStore` is the db adapter): `moveElement`,
`placeOutput`, `linkFrame`, `refreshLinks`, `landElement`. Callers: canvas actions `moveElement`,
`placeOutput`, `connect`; canvas chat tools `move_frame_element`, `place_in_frame`,
`connect_nodes`; motion agent tool `move_to_frame` (also MCP `motion_tool`);
`POST /api/v1/motion/elements` (CLI `motion move` / `motion place`); MCP `canvas_tool` ops `move_frame_element`, `place_in_frame` (`canvas-ops.ts`);
MCP `insert_row` on `nodes_connections`; a finished generation (`showRunState`).

**Placement.** Props, style and keyframes travel; timing goes through `retimer` (the
`setFrameRate` conversion, now exported). Pixel size is kept (`SIZE_PROPS`: width, height, type
size). Position is a two-row choice: laid-out components move `props.x/y` to the drop point,
the rest move `transform.x/y`; position keys shift by the same delta. Assets, fonts, custom
components and precomps the clip uses are carried. A still target covers its still frame; a video
target takes the clip at `frame` and grows to fit. New frames are fitted to the element box
(even sides, within 1920/1080) and keep the source kind; a generated picture makes a still, a
video a video.

**Revisions and undo.** Target is written first, then source; a failed source write puts the
target back (or deletes the new frame). The move answers one canvas undo step: new item kind
`doc.revision { nodeId, before, after }`, undone by restoring `before` while the head is still
`after` (`undo-plan.ts`, `undo.ts`).

**Links.** `doc.links` maps a connected source node to its element id. A new output updates that
element's asset or text; an element the user deleted is placed again. A Frame accepts only
image, video, text and media nodes (`sources`), so composition → frame → composition stays
impossible.

**UI.** `SelectionOverlay` reports a move grip released outside the frame (`ondragout`); the shell
flushes its save, the page finds the frame under the pointer (`frameUnderPointer`) or the canvas
point, and the shell adopts the lifted doc at the returned version. A generated node has a round
"Drag into a frame" handle (HTML5 drag, `CANVAS_DRAG_OUTPUT`).

**Not done / open.** The open editor's own ⌘Z after a move only restores the source doc; the
canvas ⌘Z undoes both. e2e `tests/e2e/canvas-move-elements.spec.ts` is written but not run: no
non-production stack is available and seeding production is forbidden. Regenerating a connected
node is covered by `generate.test.ts`, not e2e (no model calls).
