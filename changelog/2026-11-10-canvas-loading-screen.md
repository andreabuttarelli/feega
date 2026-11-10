# Canvas loading screen

Opening a canvas showed a blank page, then the toolbar, then frames popping
in. `CanvasLoading` covers the canvas with the logo and a bar driven by the
real startup marks (`startupProgress`, one weight per milestone in one
table), while the canvas mounts underneath. It fades at the first drawn
frame, or at renderer mount on a canvas without frames, or 1.5 s after the first build (no frame on screen), or after 10 s. Bar sits full width at the bottom edge.
`markStartup` now dispatches `feega:startup` so the bar moves live.
Discarded: a fake timed bar; it lies on slow machines.

The centre shows the app wordmark (`Wordmark.svelte`, shared with
`AppSidebar`). The bar is a pride flag, one per load in rotation
(`pride-flags.ts`, one row per flag, index in localStorage, rainbow when
storage is unavailable). The full-width gradient is revealed with
`clip-path`, so stripes keep their width as the bar grows. Flags with
symbols or chevrons were dropped: they don't read on a 3px bar.
