# Canvas: the hover outline follows the node every frame of a zoom

Hovering a node and zooming made the outline grow (zoom in) or shrink (zoom out) against the
node: its line and its 1px gap were baked into the core overlay at the zoom the hover began, and
the overlay is only re-sent once a gesture is quiet, so the retained screen scaled them with the
camera (2px, 4px, 6px across one zoom-in) until the gesture ended.

The hover outline (frame, card and open-frame empty area) is now a DOM ring placed from the live
viewport (`hoverRingStyle` in `hover-ring.ts`, drawn by `GpuFlow.svelte`), like the element pick
box already was. Same look as before: 1px gap, 1.5px line (thicker on a far view), card radius,
node rotation. The core no longer draws hover: `ChromePart.Hover`, `hoverItems` and the
`hovered` overlay field are gone, so a hover change also stops re-sending overlay parts.

Not touched: node names and selection rings are still core overlay and still lag a zoom gesture
(stale "Frame" labels at several sizes while zooming); that needs the overlay to be re-sent per
zoom step in `CoreFrames.svelte`, which belongs to the compositor work.

Checked in the browser (local mode, WebGPU): ring minus frame box is -2.5/+2.5px at every sampled
frame of a zoom-in and back, where the core ring went 2px, 4px, 6px thick.
