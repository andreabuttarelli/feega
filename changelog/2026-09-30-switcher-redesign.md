# Project and canvas switcher redesign

**Why.** The Project ▾ / Canvas ▾ dropdowns took the trigger's width (so names
truncated to "B.." with 8+ projects), mixed navigation rows with bare Rename /
Delete actions, had no search, no brand, and the mobile sheet put three equal
buttons (New / Rename / Delete) between the two lists.

**What changed.**
- Desktop menus are 300px, 32px rows, 16px icons, collision padding 8px.
- Project menu: search when > 6 projects (`needsSearch`), recent first
  (`recentFirst`), current row checked and tinted, last-edited on the right.
  Search keeps focus; ArrowDown moves to the list, Enter opens the first match.
- Canvas menu: header with project name + brand badge; current canvas row
  carries a hover pencil (rename) and a ⋯ sub-menu (Rename, Delete). "New
  canvas" is a row with a plus.
- Project rename moved from a footer item to a pencil on the current project row.
- Mobile sheet: sticky header (grabber, project + brand, search), same row
  model at 44px, delete in a ⋯ menu, rename inline in the row (Enter/Esc).
- `src/lib/canvas/switcher-list.ts` holds sort/filter/threshold, tested.

**Unchanged.** Hrefs, `submitCanvasAction` / `renameProjectAction` calls,
delete confirm, last-canvas guard, NSFW gating (`nsfw.visible`), test ids.

**Discarded.** Rename inline inside the dropdown: bits-ui typeahead fights an
input in menu content; the existing trigger-replacing input stays.
`app.shell.mobile.switchTitle` removed: the sheet title is now the project.
