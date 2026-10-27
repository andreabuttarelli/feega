# Floating canvas shell

The canvas shell was a frame of solid bars: a full-width top bar, a full-height left rail, a
docked left panel and a docked right bar that pushed the canvas aside, and the right bar opened by
default. The canvas now runs full bleed and the chrome floats over it.

- Top bar: transparent overlay, its zones (menu + switcher, canvas title, status + share + chat)
  are `full` pills. Still 48px tall so the desktop traffic lights stay on the same centre line.
- Left rail: a vertical pill centred on the left edge; the sheet divider shows only when sheets
  exist (none in local mode).
- Left panel and right bar: `lg` cards inset 12px, `--ui-shadow-float`.
- Right bar closed by default (`readChatOpen(false)`); it opens by itself while an element inside a
  frame is selected, so the inspector appears on selection and leaves with it.
- Add bar lifted 12px off the bottom edge.

Discarded: a new `FloatingGroup` component — the groups are four CSS rules over existing tokens,
a component would be an abstraction with one shape. Labels under icons (the minimal reference)
were left out: they double the chrome height and the tooltips already name every button.

`canvas-shell-layout.test.ts` now asserts the floating layout instead of the docked one.

## Follow-up: draw tools, Runs, renderer chip

- Draw tools: `src/lib/canvas/draw-dock.ts` is the one table of what sits on the bar (select,
  frame, rectangle, ellipse, text, pen) and what goes in More (line, arrow, polygon, star, pencil,
  shape builder). More is a menu row per tool: icon, name, shortcut. When a More tool is active the
  More button shows its icon. Tooltips on bar tools show name, shortcut and the one-line gesture
  already declared in `ACTIONS`. Frame tool icon `frame`, shape builder `combine`.
- Runs: icon-only round button (`history`), tooltip and aria-label "Runs", a count badge for
  running/queued runs.
- The `core` renderer chip is gone; it was dev-only and the engine is assumed right.
- Under 1180px the floating side panels stop above the add bar.
