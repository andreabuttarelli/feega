# Mobile: Canvas/Chat switch at the bottom, visual polish

The segmented Canvas/Chat switch lived in `MobileTopBar`; feedback: ugly at
the top. It now is `MobileViewSwitch`, a floating bar bottom-right with the
node bar's language (paper, 1px `--line-2`, shadow, `--mobile-bar-inset`
from the bottom + safe area). The node bar anchors bottom-left on mobile;
at 360px both fit (230 + 94 + 3 × 8). In Chat view the node bar is hidden
with the canvas and the chat reserves `--mobile-bar-clearance`, so the
composer sits above the switch. When the keyboard is open
(`keyboardOpen`, visualViewport losing > 25% of the height) the switch
hides and the clearance drops.

Tokens: `--mobile-bar-inset`, `--mobile-bar-pad`, `--mobile-bar-h`,
`--mobile-bar-clearance`, `--mobile-bar-shadow`; icon size/stroke for
mobile chrome in `MOBILE_ICON`. The canvas segment uses `Workflow`, not
`LayoutGrid`, which the node bar already uses for "More nodes".

Rough edges fixed along the way:

- Promote on mobile pushed sheet state no layout rendered (sheets are pages
  on mobile, `directLoadMode`): the button is now a link to `/promote`.
- The composer mounted hidden measured `scrollHeight` 0 and pinned its
  height to 0px, clipping the placeholder: `composerHeight(0)` leaves the
  height to CSS.
- "More nodes" popover overflowed the left edge once the bar moved left.
- Selection toolbar ran off screen; on mobile it docks under the top bar
  and scrolls horizontally.
- Burger rows were 28px: now touch targets, 15px labels, scrollable when
  taller than the viewport, "Sign out" aligned.
- Switcher sheet: drag handle, tighter rhythm, pressed states, pencil icon
  aligned inside "Rename".
- Assets: Upload goes full width under the filters instead of wrapping.

Desktop untouched: every change is under `max-width: 767px` or in
mobile-only components.
