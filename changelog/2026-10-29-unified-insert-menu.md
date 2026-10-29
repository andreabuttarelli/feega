# One + insert menu

The add bar had a Design/Generate radio: two short sets of buttons, and
whatever sat in the other set was invisible. Spec `docs/specs/editor-modes.md`
(ADR 0023, issue #1519) replaces it with one "+" menu.

- `bottom-bar.ts`: `BarMode` and its localStorage key are gone; the bar is
  a fixed `BAR_SLOTS` (select, +, comment) plus the zoom readout.
- `insert-menu.ts`: the sections per context (tools, generate, import,
  templates; a selected frame adds a frame section). The desktop popover and
  the phone Insert sheet render the same snippet from it.
- Node entries stay draggable and keep their digit shortcut.
- Onboarding step 1 points at "+" until the menu is open, then at
  Generate text.
- Discarded: keeping a few draw tools inline next to "+". The spec moves
  them into the menu; shortcuts still pick them.
