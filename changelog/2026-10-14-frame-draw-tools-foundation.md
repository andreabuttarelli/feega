# Drawing-tool geometry, not yet wired to the editor

Scope note before the module: the assignment this branch started from (Text/Rectangle/Ellipse/Pen
tools inside a Frame, direct manipulation, a Design/Motion mode switch, a Layers tree that lists
every frame's children, hover sync between Layers and canvas, and a Layers/canvas selection
unification bug) grew mid-task into six separable features, several of them production bugs on
unrelated subsystems (selection, Layers, rendering). Bundling all six into one PR, each touching
core selection/rendering code, with no real browser available to verify interaction fixes
visually, was the wrong trade against shipping something broken to a repo that auto-deploys on
merge. This PR ships the one bug fix investigated enough to be confident in (poster part
properties — see the sibling changelog entry) and the pure geometry foundation for the drawing
tools below. Everything else stays unbuilt, not half-built, and should be its own task.

`draw-tool.ts` has the pure math a Figma-like "drag inside a frame to create an element" needs:
`dragRect` (two points → a centered box, shift locks it to a square), `resizeFromCorner` (a
corner handle drag → a new box anchored at the opposite corner, same ratio-lock), `nudge` (arrow
keys), and `roundnessFromInset` (an on-canvas corner-radius handle's drag distance → the `0..0.5`
`roundness` fraction `rectOutline` already takes, relative to the shape's own shorter side).

Not wrapped in a new op: `addClip` + `setProps` + `shape/ops.ts`'s `setPath` already create and
edit a Text/Shape clip from a drag box's `{x, y, width, height}` plus `shape: 'rect' | 'ellipse'
| 'path'` — there was nothing to wrap. For the same reason AI parity needed no new tool: the chat
agent's `add_clip`/`add_shape`/`set_props` and the MCP `motion_tool` (a direct, no-AI pass-through
to the same ~140 tools) already take any prop by key, including `roundness` and a path `d`; a
human using the drawing tools and an agent calling `add_shape`+`set_props` would produce the
identical clip.

For the pen/path tool specifically: `shape/pen.ts` already has `addPoint`, `movePoint`,
`dragHandle`, `deletePoint`, `toggleClosed` on an `Outline` (bezier vertices with `in`/`out`
handles) — a full pen-tool editing model, tested, unused outside its own test file. Nothing new
needed there either; it was built and never connected to a UI.

What's still missing, and where it hooks in when someone picks this up: a toolbar (Text,
Rectangle, Ellipse, Pen next to Frame) in the open-Frame editor, not the canvas add bar — these
elements only exist inside a Frame; `SelectionOverlay.svelte` taking pointer events for the
active tool and calling `dragRect`/`addClip` on drag-end, then switching back to the select tool;
resize handles on the existing selection box calling `resizeFromCorner`; a corner-radius handle
calling `roundnessFromInset`; double-click-to-edit-text reusing the inline edit `SelectionOverlay`
already has for poster parts (`part-edit`); and `pen.ts` wired to a click sequence with the same
double-click-to-enter-point-edit-mode pattern. True per-corner (not uniform) radius would also
need `rectOutline` to take four radii instead of one — a geometry change to `shape/geometry.ts`
and `shape/schema.ts`, deliberately not attempted here.
