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

The screen now waits for every on-screen frame to show real content
(vectors, poster or thumbnail: `VectorGate.shownOf` → `reportFramesShown`
→ `all-shown` mark), with the bar tracking those frames. Cap: 4 s after
the GPU is ready, 10 s hard. White flag stripes draw as #ECECEC. The
canvas load also warms the on-screen frame sources (`early-sources.ts`),
and the app already preloads page data on link hover, so hovering a
canvas link fetches its sources too. Not cancelled on leave, posters not
prefetched. A/B at 4x CPU, 2 cold runs: reveal 2.3 s → 6.0 s (the old
one showed white placeholders), all on-screen content 7.3 s → 6.7 s.

Bar moved under the wordmark (180px, full radius) with a smooth gradient
across the flag colours. A static splash in `app.html` (inline CSS, shown
only on `/p/*/c/*` by an inline path check, removed after 10 s as a
guard) paints the wordmark and empty bar with the first paint, before
any JS; `CanvasLoading` mounts in the same place and removes it.
