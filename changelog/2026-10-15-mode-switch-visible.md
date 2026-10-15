# Design | Motion switch always on screen in the canvas bar

Reported on production: with a frame open on the canvas, no Design | Motion switch, so no way
to the timeline.

Cause: the editor bar is re-anchored into the canvas top bar's `[data-top-slot]`, which was
`flex: 1; min-width: 0` — it got only what the breadcrumb left over. With long project and canvas
names (each up to 220px) the slot shrank below the bar's content: on desktop the transport group
drew over the switch, on tablet (`overflow-x: auto`) the switch was pushed out of the slot. Short
names, the e2e default, never showed it.

Fix:
- `claimsWidth` (`src/lib/canvas/claim-width.ts`) sets the slot's `flex-basis` to the bar's
  natural width;
- in `CanvasTopBar` the breadcrumb box shrinks first (`flex-shrink: 1000`, clipped, keeps the
  menu button), the right box never shrinks, the names ellipsize (`min-width: 0`);
- the bar's lead group (title dot + switch) never shrinks.

Guard: `tests/e2e/mode-switch-visible.spec.ts`, long names, 1440/1280/1024, iPad both
orientations, iPhone, video and still frame: switch inside the viewport, top element at its
centre, clickable, Motion shows the timeline, Share/chat stay on screen.
