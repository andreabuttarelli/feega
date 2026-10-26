# Auto layout: space-around, space-evenly, negative gap

Parity roadmap P3. `Justify` gains `space-around` and `space-evenly`; like
`space-between`, they add the free main-axis space on top of the gap and fall
back to `start` when there is no free space. Inside a grid cell they center.

`gap` and `crossGap` accept negatives (down to `-MAX_LAYOUT_PX`): children
overlap, and a hugging container shrinks by the overlap. The engine already
handled it; only the schema and the Properties inputs refused it.

UI: the space-between toggle became three toggles. The motion tool
`set_auto_layout` (and the MCP `edit` op through it) takes the new values.
Baseline alignment is left for a later PR: it needs text metrics in the
layout item.
