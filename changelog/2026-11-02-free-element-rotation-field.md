# Free element rotation: one source

After #1720 a fixed root turn of a free element moves onto the node rotation, but two paths still disagreed:

- The inspector rotation field read the doc root (always 0° after the hand-off), and a typed value was added to the node rotation instead of set. The field now reads and writes the node rotation for the root of a free element (`NodeTurn`, published by GpuFlow on `frameProperties.turn`).
- Agent/MCP edits saved the turn inside the doc, so the element got cropped. `saveMotionDoc` now applies the same `elementTurn` and writes the degrees onto `data.rotation`; the node is read only when the doc carries a root turn.
