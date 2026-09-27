# The canvas top bar was full width, blocking clicks on the canvas underneath it

`CanvasTopBar.svelte` rendered as a single full-width `<header>` with
`pointer-events: none` only on the outer wrapper — but `.topbar-row` was
`width: 100%` with the switchers and chat toggle at its two ends. Anything in
between them (an empty strip the width of the viewport, minus the credits pill
tucked underneath) still had no pointer-events issue, but the bar's own layout
kept growing in that direction as controls were added, and there was no room
left for a Publish action without either cramming it into the switcher group
or widening the strip further.

## What changed

- Split into two floating boxes, `.top-box.left` (burger + Project ▾ / Canvas ▾)
  and `.top-box.right` (credits, Publish, chat toggle), each `position: absolute`,
  sized to content, `top: 8px`, `left: 8px` / `right: 8px` — same offset as
  `CanvasAddBar`'s `bottom: 8px`, same border/shadow (`1px solid var(--line-2)`,
  `0 4px 18px rgb(0 0 0 / 0.1)`).
- `.canvas-topbar` itself carries no `topbar-row` wrapper anymore, so nothing
  spans the viewport width; the canvas between and around the two boxes is
  fully clickable.
- Moved the chat-panel toggle from the old lone floating button into the right
  box, next to the new Publish button.
- Added `onPublish` prop, wired in `+layout.svelte` to
  `openSheet(projectId, '/create-post')` — the same sheet the selection
  toolbar's "create post" action and `CanvasFlow`'s `onCreatePost` already open.
  Selection-aware behavior (create directly from selected nodes) was not wired:
  `CanvasFlow`'s selection state isn't exposed outside the component, and that
  file is under concurrent edit elsewhere in this branch.
- Credits link now uses `openSheet(projectId, '/settings/billing')`, same as
  `CanvasMenu.svelte`, instead of a hard navigation to the deprecated `/app/billing`.
- Removed the project-switcher dropdown's "new brand" item, which linked `/app`
  (deprecated). No client-side action creates a new project today, so the item
  is gone rather than repointed to something that doesn't exist.

## Not done

No responsive truncation is actually exercised below 767px: `+layout.svelte`'s
`isMobile` branch swaps `CanvasTopBar` out entirely for `CanvasMobileTabs` at
that breakpoint. The `@media (max-width: 480px)` rules added here (canvas name
truncates further, Publish becomes icon-only) are defensive for any future
narrow-desktop case but aren't reachable through the current shell.
