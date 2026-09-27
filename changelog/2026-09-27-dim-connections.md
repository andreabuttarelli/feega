# Dim connections, light the selected ones

Idle edges use a muted stroke. `focusEdges` (`edge-focus.ts`) tags every
edge touching a selected node with `is-linked`, which keeps the previous
stroke. It returns null when nothing changes, so the `$effect` in
`CanvasFlow` that writes `edges` does not loop.
