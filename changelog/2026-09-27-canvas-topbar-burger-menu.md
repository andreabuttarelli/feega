# Add a burger menu to the canvas top bar

The top bar had a project/canvas switcher, a keyboard-shortcuts icon, a chat toggle and
credits — no way back to the rest of the product without leaving the canvas via a bookmark or
the browser back button.

## What changed

- `src/lib/components/canvas/CanvasMenu.svelte` (new): a burger button at the far left of
  `CanvasTopBar`, opening a `$lib/components/ui/dropdown-menu` with Home, Keyboard shortcuts
  (submenu, same `CANVAS_SHORTCUTS` list), Settings, Billing, Sign out. Items come from one
  table, `CANVAS_MENU_ITEMS` — adding a voice is a row, not another `{#if}`.
- Settings and Billing open through `openSheet` (`$lib/canvas/sheet-nav`), same mechanism the
  floating rail already uses: the sheet opens over the canvas without unmounting it. Home is a
  real navigation to `/app`, the existing idempotent bootstrap redirect
  (`src/routes/app/+page.server.ts` → `homePathFor`) — not a dead link, the sanctioned "go to my
  workspace" entry point. Sign out reuses the existing form (`method="POST"
  action="/auth/signout"`), same as `src/routes/p/[projectId]/settings/profile/+page.svelte`.
- `ShortcutsMenu.svelte` is gone: its standalone icon and dropdown are now the "Keyboard
  shortcuts" submenu inside `CanvasMenu`, so the top bar has one menu instead of two.
- `CanvasTopBar` now takes `projectId` (needed by `openSheet`), wired from
  `src/routes/p/[projectId]/+layout.svelte`.

## Tests

`src/lib/components/canvas/canvas-top-bar-menu.test.ts` (new, source-assertion style like
`add-bar.test.ts`): the menu file exists, is table-driven, lists all five actions, and wires
Home/Settings/Billing/Sign out to the right mechanism. `src/lib/canvas/add-bar.test.ts` updated:
the "shortcuts live in the top bar" assertion now points at `CanvasMenu.svelte` instead of the
removed `ShortcutsMenu.svelte`.
