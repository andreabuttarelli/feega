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
