# Mobile: Canvas/Chat switch in the top bar, burger navigation

**Before.** Mobile had a bottom tab bar (Canvas · Chat · Calendar · More) plus a "More" sheet
with its own copy of the rail entries. The chat was mounted with `{#if}` only while Chat was
the active tab.

**Now.**
- Bottom tab bar and More sheet removed (`CanvasMobileTabs`, `CanvasMobileMore`, `MOBILE_TABS`,
  `activeMobileTab`, `--mobile-tabbar-h`).
- `MobileTopBar` carries a segmented Canvas/Chat switch (44px segments) on the canvas route; on
  other pages a "Canvas" back link instead.
- The chat is always mounted on mobile and toggled with `display`, so a running turn keeps
  streaming while the canvas is shown. The node add bar lives inside the canvas view and hides
  with it; on mobile its buttons are 44px.
- The Chat segment shows a spinner while a turn runs and a dot when a reply finished while the
  canvas was shown. State machine: `src/lib/canvas/mobile-view.ts`.
- `anyChatRunning()` is now reactive: a module-level `$state` counter updated in `send()`. A
  `SvelteMap` of sessions was discarded: `chatSession()` runs inside a `$derived`, where
  mutating state throws.
- The burger (`CanvasMenu`, `railPages="include"`) lists `BURGER_ENTRIES`, built from the same
  `NAV_ENTRIES` groups the rail reads; its own Settings row is dropped there since the rail has
  one. Icons shared in `nav-icons.ts`.
- Leave guard unchanged: burger rows are links, so `beforeNavigate` still asks. The switch never
  navigates, so it is never guarded.

**Discarded.** A second floating bar at the bottom for the switch: the top bar was preferred.
