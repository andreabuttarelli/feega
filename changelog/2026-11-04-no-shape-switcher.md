# The kind of a shape is chosen once

The Properties panel had a `Shape` dropdown (field `shape` of the Shape component) that
changed a rectangle into an ellipse and back after creation. Removed: `fieldShown` in
`properties-view.ts` hides `shape`, and the agent's `set_props` refuses `shape` on a Shape
clip (`SHAPE_KIND_FIXED`), pointing at `add_shape`. Internal ops (convert to path, point
edit, outline text) still write `shape: path` through `setProps`: that is a conversion, not
a switch, so the guard sits in the tool and not in `setProps`. Morph targets stay: they
animate between outlines and do not change the kind.

Start/Sweep/Ratio, polygon sides and star points were already filtered per kind by
`shapeFieldShown`; they now show without a switcher beside them. The CLI and MCP call
`edit` with the same tool, so no command changed. Tool-surface pins are unchanged (the
tool description is the same).

The report showed `Rectangle` next to Start/Sweep/Ratio. Not reproduced: an ellipse shows
`Ellipse` in the select and the arc fields are gated by the real kind (screenshots in
`~/Documents/feega-videos/fixes/shape-switch/`). The mismatch was a control disagreeing with
the fields beside it; removing the control removes the case. A transparent stack over a shape
takes the click (panel title `Stack`), which can make the selected layer a different one.

Also fixed: the canvas page re-ran its outbox restore in a loop (`$effect` writing `nodes`
without `untrack`), which froze the page when a frame was present.
