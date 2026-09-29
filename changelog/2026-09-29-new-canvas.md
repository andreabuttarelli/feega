# Create, rename and delete canvases

A project had exactly one canvas: `/p/[projectId]` created it on first visit and
nothing else could make, rename or remove one. The "Canvas" dropdown (desktop)
and the mobile switcher sheet now carry New, Rename and Delete.

Path: menu item in `CanvasTopBar.svelte` / `CanvasMobileSwitcher.svelte` →
`submitCanvasAction` (`$lib/canvas/canvas-list.ts`) → `new_canvas`,
`rename_canvas`, `delete_canvas` in `c/[canvasId]/+page.server.ts` →
`lifecycle.ts` → `createCanvas` / `renameCanvas` / `deleteCanvas` → `canvases`.
Every action resolves the org through `findCanvasForUser`, so another org's
canvas is a 404.

Decisions:

- New canvases are named `Untitled canvas N`, N one past the highest taken.
- Delete is hard. `canvases` has no `deleted_at`, and deploys don't run
  migrations, so a soft-delete column would ship code ahead of the schema. The
  cascade removes nodes, connections, events and `post_sources` rows; posts
  themselves survive. A browser confirm guards it.
- The last canvas of a project cannot be deleted: the action answers 409 and
  the menu item is disabled.
- Other tabs see the list change: the canvas realtime channel now also listens
  to `canvases` for the project and invalidates `app:canvases`.
- Duplicate was dropped: `duplicateNodes` writes into the source canvas with an
  offset, so copying into a new canvas is a separate change, not a reuse.
- No CLI or MCP surface: canvases have none today.
