# Canvas loading screen

Opening a canvas showed a blank page, then the toolbar, then frames popping
in. `CanvasLoading` covers the canvas with the logo and a bar driven by the
real startup marks (`startupProgress`, one weight per milestone in one
table), while the canvas mounts underneath. It fades at the first drawn
frame, or at renderer mount on a canvas without frames, or after 10 s.
`markStartup` now dispatches `feega:startup` so the bar moves live.
Discarded: a fake timed bar; it lies on slow machines.
