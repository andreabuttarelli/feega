# Constraints

Clip props are fractions of the frame, so until now every resize scaled every
layer. A clip can now carry `constraints` (horizontal left / right /
left_right / center / scale, vertical top / bottom / top_bottom / center /
scale; absent = scale, the old behaviour). When the frame changes size,
`withConstraints` rewrites x/y/width/height so the pinned edges keep their
pixel distance; one rule per value in `HORIZONTAL`/`VERTICAL`.

Applied on the resize paths, not inside `setCanvas`: the Frame inspector size
and format, the frame dragged on the canvas (`fitToNode`, client and
`frameSize` endpoint) and the agent's `set_canvas`. `reformat` (Create formats)
keeps its own refit and is untouched, or it would refit twice. Clips with a
parent follow the parent and are skipped.

Edited in the Constraints section of a selected layer; agent:
`set_layout_item` `constraints`, read back by `get_motion_doc`. No new tool
name.
