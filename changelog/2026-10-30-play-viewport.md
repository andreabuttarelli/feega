# Play viewport modes

Before: the player fitted the frame's aspect ratio into the window, so a tall landing page was a thumbnail and breakpoint views could not be tried.

Now: a toolbar under the player header picks a mode from the `MODES` table in `src/lib/motion/prototype/viewport.ts` (Fit, Fill width, 100%, Responsive). `frameBox` turns mode, stage size and frame size into width, height, scale and whether the stage scrolls. The frame is drawn at its pixel size and scaled with a transform inside a sizer of the scaled size, so scroll extents are right and hotspots (percent boxes) keep working.

Responsive sets the frame width (presets 1440 / 768 / 390, number field, or a handle on either edge). `activeView` picks the narrowest breakpoint at least as wide as the width, the `max-width` rule of ADR 0022; `docAtWidth` runs `resolveView` for it and re-lays the doc at the exact width. Overlays and navigated frames use the same width. The choice is stored per start frame in localStorage (`feega.playView.<id>`).

Mobile: the stage allows pan and pinch zoom. Not done: the Play on canvas inline iframe keeps its own sizing.
