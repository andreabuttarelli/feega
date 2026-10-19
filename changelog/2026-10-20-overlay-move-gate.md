# Frame overlay skips repeated pointer work

Profiling a landing resize showed the in-place frame editor's `SelectionOverlay` running its
hover probe (`probe` -> `liveStack` -> auto layout) on every pointer move, including while a
button is held for a drag it does not own, and forwarding identical host-drag points to
`hostDrag` (which re-places the node). Hover now probes only for a hovering mouse with no button
held and when the point or the laid-out doc changed (`move-gate.ts`); host drags forward only
moved points. Chrome landing resize, worst frame: gpu 133 -> 33 ms, core 617 -> 33 ms.
