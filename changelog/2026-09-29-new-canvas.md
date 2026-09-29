# Create, rename and delete canvases; rename a project

A project had exactly one canvas: `/p/[projectId]` created it on first visit and
nothing else could make, rename or remove one. The "Canvas" dropdown (desktop)
and the mobile switcher sheet now carry New, Rename and Delete. A project could
only be renamed from `/p/[projectId]/settings/project`; the "Project" dropdown
(desktop) and the mobile switcher's projects section now rename it inline too.

Path: menu item in `CanvasTopBar.svelte` / `CanvasMobileSwitcher.svelte` →
`submitCanvasAction` (`$lib/canvas/canvas-list.ts`) → `new_canvas`,
`rename_canvas`, `delete_canvas` in `c/[canvasId]/+page.server.ts` →
`lifecycle.ts` → `createCanvas` / `renameCanvas` / `deleteCanvas` → `canvases`.
Every action resolves the org through `findCanvasForUser`, so another org's
canvas is a 404.

Decisions:

- New canvases are named `Untitled canvas N`, N one past the highest taken.
- Delete is soft (`20260929180000_canvases_soft_delete.sql`, applied to
  production ahead of this branch by explicit authorization): `deleteCanvas`
  sets `canvases.deleted_at` instead of removing the row. Nodes, connections,
  `canvas_events` and `post_sources` are untouched — a published post keeps
  its source links even after the canvas it came from is deleted. Every canvas
  read (`listCanvases`, `findCanvasForUser`, the share viewer's lookup by
  token) filters `deleted_at is null`, the same convention `nodes.deleted_at`
  already uses. `confirm()` was replaced with `ConfirmDialog.svelte`
  (`$lib/components/`), the same overlay pattern as `DeleteBrandDialog`, minus
  the typed-confirmation requirement.
- The last canvas of a project cannot be deleted, counting live canvases only:
  a project with one soft-deleted and one live canvas still refuses to delete
  the live one. The action answers 409 and the menu item is disabled.
- Other tabs see the list change: the canvas realtime channel already routes
  every `canvases` event (insert, rename, delete) to a full list refetch, so a
  soft delete (an UPDATE with `deleted_at` set) drops out the same way a hard
  DELETE would have — no special-casing needed in `canvas-channel.ts`.
- Known gap: the generic MCP/CLI `query` tool (`cli/mcp/tools/org-data.ts` →
  `src/lib/server/org-data/query-tool.ts`) applies no per-table filtering at
  all — it doesn't exclude soft-deleted `nodes` today either, so a
  soft-deleted canvas is visible to it the same way a soft-deleted node is.
  Not fixed here: there is no existing convention to mirror, and inventing
  generic per-table filtering was out of scope for this change.
- Duplicate was dropped: `duplicateNodes` writes into the source canvas with an
  offset, so copying into a new canvas is a separate change, not a reuse.
- No CLI or MCP surface: canvases have none today.

## Project rename, reachable from the canvas

Path: `project-rename` item in `CanvasTopBar.svelte` / `CanvasMobileSwitcher.svelte`
→ `renameProjectAction` (`$lib/canvas/canvas-list.ts`) → `rename_project` in
`c/[canvasId]/+page.server.ts` → `renameProject` (`repos/projects.ts`) →
`projects`. Reuses the same `renameProject` the settings page's `rename` action
already calls, rather than a second implementation.

- Scoped by org (`eq('org_id', ...)`) and excludes archived projects
  (`is('archived_at', null)`), same guard `ownedProject` uses in the settings
  route — a project of another org, or one already archived, 404s.
- Empty name refused (400), matching the existing canvas-rename action's
  behavior; no client-side duplicate of that check.
- The list refreshes live: `renameProjectAction` invalidates
  `CANVAS_LIST_DEPENDENCY`, the same dependency key `submitCanvasAction` already
  invalidates and the project layout's `load` already declares — no new
  realtime path needed, the existing one already refetches both `projects` and
  `canvases` together.
- The route the action lives on (`/p/[projectId]/c/[canvasId]`) is the only one
  that renders `CanvasTopBar`/`CanvasMobileSwitcher`, so `canvasHref` is always
  available to build the `?/rename_project` URL from.
