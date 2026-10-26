# On-canvas gradient handles

Gradients could be edited only in the inspector. A selected element whose top visible fill is a
linear, radial or angular gradient now shows Figma-style handles: two ends and a dot per stop.

- Pure geometry in `src/lib/canvas/gradient-handles.ts` (fill ↔ handle points, both ways),
  same angle convention as the GPU painter and the CSS export (0° = left to right).
- No model change: drags write `angle` / `center` / `radius` / stop `pos` on the existing fill.
- Live preview through `liveDocs`, one history entry on release.
- MCP already sets the same fields through `set_props` fills.

Not done: diamond gradients (no parameters to drag), handles on rotated elements follow the
unrotated box.
