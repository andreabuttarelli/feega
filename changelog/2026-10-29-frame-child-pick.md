# Frames pick their children again, not the page that fills them

- Since #1554 (`14f7d47eb`) hover goes through `pickTarget` with `Reach.Top`. On a frame
  whose only layer is a full-frame container (agent landings like Ledgerline, Figma imports
  with a background container) the top-level element is always that container: hover and
  click outlined the whole frame and nothing inside was reachable. Click had the same rule
  before; #1554 extended it to hover, which made the defect total.
- `framePage` (`frame-select.ts`): the sole root layer spanning the frame and holding
  children is the frame's page. `clickTarget` skips it, so a click picks its child; a click
  on the bare page picks nothing and the frame stays selected. `parentPick` skips it too:
  Esc from a section goes to the frame.
- Double-click on a container went into point editing (`canEditPoints` on any Shape) and
  rewrote the container as a path. `editsPoints` refuses shapes that hold children.
- Double-click selected the deepest leaf; `childBelow` now descends one level from the pick.
- Selection in a breakpoint view did not draw: `marksIn` read `savers` (a plain `Map`) before
  `picks`, so a view overlay rendered before the session existed kept no dependency. It now
  reads the marks first.
- Discarded: dropping containers from the paint pick (fill-less sections would vanish).
- Guard: `tests/e2e/canvas-frame-child-pick.spec.ts` (Ledgerline with surface, base frame
  and tablet view) and `pick-rule.test.ts` on the real picker.
