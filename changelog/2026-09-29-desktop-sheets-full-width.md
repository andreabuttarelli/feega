# Desktop sheets fill the canvas stage

Calendar, Ads, Settings and Promote opened over the canvas were a fixed
column (`SHEET_WIDTHS`: 960/720/720/880px) anchored at `left: 60px` and
portaled to `body`. At 1440px the Settings content got 454px while the
same page opened by URL got 1192px; the canvas stayed visible on the right.

The sheet now renders inside `.canvas-stage` (portal disabled) and is
anchored to both edges (`left: 60px; right: 0`): 1100px at 1440, 940px at
1280, never under the chat panel. The table is renamed `PANEL_WIDTHS`
and keeps only the 320px side panels.

Guards: `canvas-sheet-layout.test.ts` (no sheet in the width table, portal
disabled, right edge anchored) and an e2e in `shell.spec.ts` asserting the
calendar content is wider than 1000px at 1440.

Discarded: per-page widths or bumping the numbers — still a column, still
wrong at the next viewport. The global classes in `app.css` were not the
cause (measured) and were left alone.
