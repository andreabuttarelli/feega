# Mobile: one shell on every project page

Before, the mobile chrome (`CanvasMobileTabs`) mounted only on the canvas route; every other page
under `/p/[projectId]` rendered bare `children()`: no top bar, no tab bar, no way back. The canvas
itself had no top bar either (desktop-only `CanvasTopBar`), and page titles were invisible
everywhere because `PageHead` writes `pageMeta`/`pageTopActions` and nothing read them since the
old app shell went away. Burger items Settings/Billing called `openSheet`, but `CanvasSheet` is
not mounted on mobile, so they did nothing.

## What changed

- `+layout.svelte`: one mobile branch for every route — `MobileTopBar` (burger, title from
  `pageMeta` or canvas/project name, page actions, share on canvas, credits), a scrolling
  `main`, the tab bar. Chat is a view over any page, not a canvas-only state.
- `shell-nav.ts`: `activeMobileTab` and `mobileTabHref` derive the lit tab from the path, from
  the `root` column of `MOBILE_TABS` — no per-page `if`.
- `CanvasMenu` takes `navigation: 'sheet' | 'page'`; mobile uses plain links.
- Tokens `--mobile-topbar-h`, `--mobile-tabbar-h`, `--touch-target` in `tailwind.css`;
  `MOBILE_QUERY` in `$lib/breakpoints.ts`; the shell exposes `data-viewport` so pages style
  their mobile layout from the same breakpoint instead of their own numbers.
- Safe-area insets on both bars; `viewport-fit=cover` in `app.html`.

- Settings on mobile is list → detail: `/settings` without a query string now renders the
  section index (`SETTINGS_GROUPS`) instead of redirecting; OAuth returns (`?connected`,
  `?error`) still redirect to connected accounts. The More sheet reaches it through
  `NavEntry.mobilePath`; each section shows a back link on mobile. Desktop keeps opening
  `/settings/connected-accounts` as before.
- Calendar on mobile: the 7-column month grid hides; an agenda (strip of day chips, then only
  the days with posts) takes its place, the unscheduled tray stacks below, and the post
  popover becomes a bottom sheet. Same data (`placePosts`), no second model.

Discarded: a fixed-position tab bar with padded pages — a flex column where `main` is the only
scroller keeps content out from under the bars without every page knowing their heights.
