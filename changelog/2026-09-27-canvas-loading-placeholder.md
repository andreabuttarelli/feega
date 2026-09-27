# The canvas navigation placeholder still showed the old app shell

`AppEntryShimmer` (`src/lib/components/AppEntryShimmer.svelte`) is shown by the root
layout (`src/routes/+layout.svelte`, `showAppEntry`) while a client-side navigation
into `/app` or `/p/<projectId>` is still resolving. It renders a left sidebar rail
with a logo and stacked nav items, plus a top bar and `WorkbenchPageShimmer` cards —
the shell of a sidebar-based app that no longer exists. The real canvas
(`src/routes/p/[projectId]/+layout.svelte`) has no sidebar: two floating boxes top-left
and top-right, a floating icon rail on the left, a floating add-bar bottom-center, and
a resizable chat panel on the right, all over a dotted paper background. Since the
navigation target for `/p/` is almost always the canvas, the placeholder no longer
resembled the destination and the swap read as a layout jump.

## What changed

- Added `src/lib/components/CanvasEntryShimmer.svelte`, mirroring the real canvas
  chrome's box positions/sizes read straight from `CanvasTopBar.svelte`,
  `FloatingRail.svelte`, `CanvasAddBar.svelte` and `CanvasChatPanel.svelte` (8px
  offsets, `--paper`/`--line-2` colors, `var(--radius)` square corners, dotted
  background matching `Background gap={24}` from `@xyflow/svelte`).
- `src/routes/+layout.svelte`: `showAppEntry` navigations into `/p/` now render
  `CanvasEntryShimmer` instead of `AppEntryShimmer`; plain `/app` navigation is
  unaffected.
- Respects `prefers-reduced-motion` (shimmer animation disabled), matching the
  existing `AppEntryShimmer` convention.

## Decisions

Did not touch `CanvasTopBar.svelte` / `FloatingRail.svelte` / `CanvasAddBar.svelte` —
another agent has concurrent uncommitted work there (adding a Share button). No
shared "floating box" CSS class exists yet across those three components (each
duplicates the `top/bottom: 8px`, `border`, `box-shadow` values); extracting one was
out of scope here given the concurrent edits, so the placeholder hardcodes the same
values instead of importing a shared class. Left `WorkbenchPageShimmer.svelte`'s
unused `workbench` variant in place — it's dead code from before this shell existed,
but removing it is a separate cleanup, not part of this fix.

## Verified

Captured two screenshots with a disposable Playwright script against a real
throttled navigation between two seeded projects: the shimmer's box positions, rail
icon count/grouping, add-bar icon count and chat panel presence match the loaded
canvas pixel-for-pixel in layout terms (skeleton bar content obviously differs).
