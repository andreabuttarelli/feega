# Conflict notice on the canvas, History conflict row, quiet expected 404s

- **Conflict notice.** A refused write (409, row in `canvas_conflicts`) was only visible in History.
  `watchRefusals` (`src/lib/realtime/conflict-channel.ts`) listens to INSERTs on `canvas_conflicts`
  for the canvas; when the refused actor is the signed-in user it sets the existing `failed` banner
  in the canvas page. No second toast system.
- **History row.** The revert-choice block styled `.conflict` as a column, overriding the
  `.row.conflict` flex row, so a conflict row collapsed into an overlapping bar. Renamed to `.choice`.
- **Head 404.** A freshly drawn element has a node row before its head exists. The route now
  answers 204 for that (404 stays for a node not on the canvas); `CoreFrames` treats 204 as
  "not yet" and keeps retrying through `untilFound`.
- **`remove` / `move` 404.** Both idempotent: an id already gone is a success. `removeNodes` skips
  ids not on the canvas. Discarded: swallowing the 404 on the client only, since API/CLI callers
  get the same noise.
