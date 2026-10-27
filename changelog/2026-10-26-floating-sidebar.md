# Floating dashboard sidebar

The sidebar was a full-height flush column that scrolled as a whole, so
the account footer left the screen on short windows, and it listed every
project.

- Projects list removed. "New project" and "Import .feega" stay.
- Footer (account, workspace) is pinned; the rest scrolls on its own.
- Desktop: inset by `--ui-space-2` from the viewport, `rounded-lg`
  (`--ui-radius-lg`), `--ui-shadow-float`. The drawer on narrow screens
  is unchanged.
- `AppSidebar` loses its `projects` prop. Offsets of the top bar are not
  touched (desktop shell work lives in #1342).
