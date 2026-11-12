# Inspector: fixes from the mouse-and-keyboard audit

The inspector audit (draft #2088: 122 rows, a reach sweep over 21 layer kinds) found controls a
person could not operate with a real mouse or keyboard. This closes the ones not already fixed by
#2097, #2106 and #2107.

**Keyboard.**
- Gradient stops are `role="slider"` buttons named `Stop n of m` with `aria-valuetext`
  `"50%, FF0000"`. Arrows move 1% (Shift 10%), Home/End go to the ends, Delete/Backspace remove
  (never below two, `removeStop` decides). Adding by keyboard is an explicit **+** button beside
  Position, not Enter on the bar: the bar is not focusable, and a button reads as what it does.
  It places the stop at `widestGapMiddle` (motion-core fill model) — the middle of the widest gap
  between stops. Each move is an `Edit gradient` edit, so held keys coalesce into one undo step
  (the 800 ms window of the edit session), like the colour picker's arrows.
- The fill row toggled its popover on any bubbling Enter: Enter on the swatch opened it (row
  keydown) and closed it (the swatch's own click). The row now answers only Enter/Space aimed at
  itself.
- Enter in the colour picker's hex, channel or opacity field blurred to the body, so the next key
  went to the canvas and Tab left the popover. It now applies and selects the text in place.
  `NumberField` (`fieldKeys`) still leaves the field on Enter on purpose: its test says app undo
  must own the next Cmd+Z.
- A bits-ui menu opened from a toolbar returned focus to its trigger after a pointer close.
  `leaveMenu` in `key-region.svelte.ts` reads the `pointer` column of `REACH`: a commands-region
  trigger closed by pointer (`last-input.ts`) gives focus to the canvas; by keyboard it keeps the
  trigger. The trigger is the expanded `aria-haspopup="menu"` button outside the menu
  (`open-trigger.ts`): bits-ui opens on pointerdown without focusing it.
- Stack sizing menus (`StackSizeChip`) were hand-rolled and outside the Escape stack; they use
  `dismissible` now.

**Arrow keys on colour sliders could not be undone** — not reproduced on dev: the side popover is
appended to body, which before #2097 was the canvas region, so an arrow also nudged the layer and
one Cmd+Z undid the nudge. Single presses and held bursts now undo in one step.

**W ArrowUp on a Fill child.** Like Figma, a key or a typed value turns Fill into Fixed and steps
from the laid-out size. The audit's case (imported `USDB` text) is capped by its stack: `fitted`
in auto-layout clamps a child wider than the room. The chip now says `Capped at 74 px by the
stack` instead of silently doing nothing.

**Layout.**
- The colour popover (`ColorField`) lived inside the right bar's stacking context, under the add
  bar; it is appended to body (`on-body.ts`, shared with `SidePopover`).
- Shell menus had a fixed `60vh` cap and no collision padding; they use bits-ui's available
  height and an 8 px margin, so long menus scroll inside the viewport.
- Overlay scrollbars covered the stroke popover's Per side checkbox: popovers use thin scrollbars.
- `SegmentedControl` items had `min-w-7` in `auto-cols-fr` tracks narrower than 28 px, so
  neighbours overlapped. Tracks are `minmax(0, 1fr)`; the text align row weights each group by
  its option count.

**Hit areas.** One token, `--ui-hit: 24px`, and one rule, `.hit` (app.css): a 24 px box with the
glyph drawn by `::before` from `--glyph*` variables. Used by pivot dots, constraint pins, stack
spots, colour swatches and tracks, gradient stops and colour chips; keyframe marks, inline paint
inputs and text links take the token directly. The pivot became a 72 px grid, so rotation and
flips stack beside it.

**Not done here.** Native checkboxes (Per side, Clip content, Ignore auto layout, effect flags)
stay 13 px; their label row is the hit area. Bind chips are 22 px. Text hit-testing uses the drawn
glyphs, so a double-click on the empty part of a wide right-aligned text box picks its container.
