# Layout guides

A frame carries `layoutGuides` (columns, rows or a square grid; count, gutter,
margin, cell size, per-guide hide). They live in the doc so they save, sync and
reach the agent like any other frame setting; showing them (⇧G) is view state.

Drawn by `LayoutGuidesOverlay` as a child of `MotionPreview`, above both the HTML
and the GPU engine, never in compose: no export sees them. Column and row edges
join the snap targets of a drag. Agent: `set_canvas` `layout_guides`, read back
by `get_motion_doc`. A separate tool name was not added: the tool budget is near
its cap.
