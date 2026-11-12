# Import map: see what a code import left out, add pages to the same frame

A frame imported from code knew its routes and nothing else: to bring one more page the user
re-imported into a new frame, whose components could not be instances of the first frame's
mains. The origin now keeps the map of the import (every discovered route with its state and
boards, the library, token counts, the revision), and `import_code` takes `into` to capture only
the asked route × condition pairs and land them in the same frame.

Decisions:

- **Merge, not re-plan.** The old captures are gone, so the new boards are planned alone in a
  scratch frame and merged (`addBoards`): mains reused when set, variant and layer skeleton
  match, variables and styles by name, the frame's values win.
- **Placement.** Below or beside, whichever keeps the short side put: text sizes are fractions of
  it with a floor of 0.001, and growing it pushed a 12 px style under the floor (every save
  failed with 400). A merge that would not parse is refused as `no_room`.
- **20 boards per frame.** Pull re-captures every board in one run; the capture budget fits ~21.
- **One undo step in the editor.** The server answers the piece, the editor shows a placeholder
  (`showPending`, saved, not undoable) and lands the boards as one step. Code mode is read-only,
  so importing from it switches to Design.
- **Map is f(origin, doc).** A board deleted or undone reads "not on canvas" from the doc, not
  from a flag that would go stale.

Also fixed on the way: the origin capped `routes` at 8 while imports take 20 (a 9-route frame
lost Pull/Publish); the Code inspector crashed on a layer binding one variable twice; Pull
re-imported routes × conditions instead of the boards the frame actually has.

Not done: bringing uncaptured components onto the canvas (needs the gallery step); a placeholder
for CLI/MCP imports (they write the revision directly).
