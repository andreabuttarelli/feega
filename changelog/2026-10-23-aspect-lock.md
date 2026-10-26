# Aspect ratio lock

Only Shift while drawing kept proportions. Now a clip carries `lockRatio` (optional, so saved
documents are untouched):

- `setProps` keeps the pixel ratio when exactly one of `width` / `height` changes on a locked clip,
  so the inspector fields, paste of properties and MCP `set_props` all follow it.
- A resize handle drag keeps the ratio on a locked clip, as Shift does; Ctrl unlocks for that drag
  (`withLock` in `canvas/frame-transform.ts`).
- Inspector: a lock toggle next to X/Y (`Tool.LockRatio` / `Tool.UnlockRatio`). MCP:
  `set_visibility` takes `lock_ratio` (its tool pin was updated on purpose).
Browser check: `tests/e2e/canvas-aspect-lock.spec.ts`; the handle drag is unit-tested only.
