# Canvas search and link to selection

F4 (flora-vs-feega). The canvas had no way to find a node by content, nor to share a selection.

- Cmd/Ctrl+F opens `NodeSearch.svelte`: matches `displayName`, `title`, `prompt`, `text`,
  `caption` (`node-search.ts`, every word must match); Enter jumps with `focusOn(..., Select)`.
  Mounted in the canvas page, not in `GpuFlow`.
- "Copy link to selection" button when something is selected: `?nodes=a,b` (`selection-link.ts`).
  On load the page selects and zooms those nodes through the same path as `?frame=`, then
  removes the param.
- Browser Cmd+F is intercepted on the canvas only.
- Not done here: highlight of all matches on the canvas.
