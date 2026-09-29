# Mobile project/canvas switcher

Desktop has `CanvasTopBar`'s Project ▾ / Canvas ▾ dropdowns; mobile had no
way to switch either — the title in `MobileTopBar` was static text.

The title is now a button. Tapping it opens `CanvasMobileSwitcher`, a
bottom sheet listing the current project's canvases and the user's other
projects, each row a real `<a href>` (same `href`s the layout already
computes for desktop, so switching is plain navigation, not a client-side
router reimplementation). `formatLastEdited` moved out of `CanvasTopBar`
into `src/lib/canvas/format-last-edited.ts` (move-only commit) so both
surfaces format "3 Sep" / "14:20" the same way.

No "new canvas" action exists anywhere in the UI today (only a
server-side auto-create on first visit to `/p/[projectId]`), so the
mobile sheet doesn't invent one — matching desktop, which also has none.
