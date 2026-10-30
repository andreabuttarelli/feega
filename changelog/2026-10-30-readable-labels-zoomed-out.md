# Frame and node names stay readable when zoomed out

Names above frames and nodes were world-space vector text: they shrank with the zoom and were
unreadable below ~30%.

- `core/label-size.ts` holds the curve: `screenPx = 12 * clamp(zoom^0.3, 0.8, 1)`. 12px from 100%
  up, ~10.8px at 50%, floor 9.6px from ~48% down. Constants named next to it.
- Above 100% the world size is unchanged (labels still grow with the zoom): holding 12px on
  screen there would redraw every card on every zoom tick for zooming in, which is not where
  the problem is.
- Drawn at the stepped zoom (`labelZoomStep`, 8 steps per octave, at most 9% off). Still vector
  paths, so crisp at any size; a card or frame chrome is rebuilt only when the step changes,
  not on every tick.
- Icon, gap, pad and colour dot scale with the label, so the on-screen offset from the top-left
  stays constant. Text truncates to the frame width as before.
- Label, icon and dot are hidden when the frame is under 24px wide on screen.
- `CHROME_REACH.top` grows with the label (`reachTop`): the cached card box is scissored, a
  larger label would be cut otherwise.

Discarded: a screen-space text pass (new pipeline, second place that knows frame geometry).

## Outlines and handles

Hover ring, selection ring and resize handles were world-space, so they thinned as the canvas
zoomed out. `label-size.ts` now also holds their screen widths: hover 1.5px, selection 2px,
handles 8px, boosted up to 1.5x from 25% down to 5% (`strokeWorld`). Drawn at a 16-steps-per-octave
zoom (`strokeZoomStep`, within 3%), so only ringed tiles rebuild per step. The live hover box in
`overlay.ts` uses the same function. `FrameSelection.svelte` (DOM) is already screen-space and
unchanged.
