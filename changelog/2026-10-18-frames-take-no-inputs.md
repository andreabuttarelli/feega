# Frames take no inputs

User decision: a motion/design frame (`motion` node) has no input ports.

Before: `NODE_PORTS.motion` declared `images/videos/text` inputs and
`CANVAS_NODE_SPECS.motion` accepted them. Connecting a generative node
into a frame (canvas drag, `connect_nodes`, `insert_row` on
`nodes_connections`) called `linkFrame`: the output was placed in the
frame doc as an element and recorded in `doc.links[sourceId]`; each new
generation of the source (`refreshLinks` in `generate.ts`) replaced
that element's asset.

Now: `NODE_PORTS.motion.inputs` is empty, so GpuFlow and CanvasFlow draw
no input handle; `canConnect` refuses any edge into a frame
(`FRAME_NO_INPUTS`), and `insert_row` on `nodes_connections` runs the
same `connectRefusal`. `refreshLinks`/`fedFrames` are gone. The frame
output (`motions` into a composition) stays.

Existing lines: on canvas load `canvasFrameInputs` retires every line
into a frame. If `doc.links` already names the source, the effect is
materialised and only the line is soft-deleted; otherwise `linkFrame`
places the output first. A source with nothing generated loses the
line (no content to keep). A failed write keeps the line for the next
load. Idempotent, no SQL migration.

Discarded: a SQL migration deleting the rows (destructive, and unable
to place outputs not yet materialised).
