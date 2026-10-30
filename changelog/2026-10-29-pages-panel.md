# Pages in the left panel (#1518)

The canvas-name dropdown in the top bar held switch, new, rename, delete,
versions, comments and .feega import/export. Per ADR 0023
(`docs/specs/editor-modes.md`) they move to a Figma-style left panel:
**Pages** (the project's canvases) above **Layers** (current page).

- `PagesList.svelte` is the one list; desktop left panel (`layers` kind)
  and the mobile switcher sheet (`Density.Touch`) both render it.
- Current row `…`: rename, versions, comments, delete. Panel `…`:
  import/download .feega. `+`: new page.
- Top bar keeps burger + project switcher only; canvas props removed.
- Hide/lock on Layers rows already existed.
- e2e specs and the comments demo open Pages with `Alt+1` instead of
  the removed `canvas-switcher`.
- Not done: opening the panel by default; versions/comments on mobile.
