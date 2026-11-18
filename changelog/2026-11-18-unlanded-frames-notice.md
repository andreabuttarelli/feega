# Import and restore name the frames they could not land

After `saveMotionDoc` started answering `Invalid` for a malformed doc instead of throwing, the
`.feega` import (`fillCanvas`) and canvas-version restore (`restoreCanvasVersion`) loops ignored the
outcome: a damaged frame was skipped in silence and the user believed everything came in.

Both loops now collect every frame whose save is not `Written` (`Invalid` or `Conflict`) and return
their names as `unlanded`. The rest still lands. `unlandedNotice` (`src/lib/canvas/unlanded-frames.ts`)
builds the one sentence both surfaces show: "N frames could not be imported/restored: <names>".

- Import: the `import_canvas_file` page actions (canvas page, home) answer `{ location, unlanded }`
  instead of a 303, so the client can carry the notice across `goto` with `carryNotice`; the canvas
  page shows it on open as it shows every carried notice. The API/MCP op adds `unlanded` to its answer.
- Restore: `actAt` passes `unlanded` through; the History panel shows it as its status notice.

Rejected: a query parameter on the redirect, which would need parsing and stripping on the canvas page.
