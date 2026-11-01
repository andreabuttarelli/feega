# URL import: under a minute on Browserless

Importing stripe.com in production took ~4 minutes: the Browserless session (120 s cap) was
killed mid-capture, the read came back unreadable and `importPageAt` read the page again from
scratch with the native IntersectionObserver in a second session.

## Where the time went (stripe.com, Browserless `production-sfo`)

- Every call to the page is a round trip (~180 ms from Europe). The scroll pass made 44 of them,
  each snapshot about a dozen (27 snapshots: ~70 s).
- `goto` waited for `networkidle2` until its 20 s cap and each of three settles its full 6 s: a web
  worker and two out-of-process iframes never end as puppeteer sees them.
- With every IntersectionObserver told "in view", every WebGL scene keeps drawing, and Browserless
  draws WebGL in software: the walk took 15 s and the first call after scrolling back to the top
  waited 30-43 s on the main thread. A run with WebGL off had neither.

## What changed

- The walk runs inside the page in one evaluate (`inViewSampled(walk)`), with a frame between
  steps so an infinite animation still reads as restless.
- A snapshot is one staging evaluate plus a viewport `page.screenshot` cropped with sharp (a clip
  makes puppeteer read the viewport first: one more round trip); the transparent background
  switches per mode, not per shot; a picture goes back into the page only for a live element.
  Tried and dropped: `Page.captureScreenshot` on a second CDP session left apple.com missing
  images in every later full-page screenshot. Staging scrolls with `behavior: 'instant'`:
  supabase.com scrolls smoothly and the crops landed above the page.
- `goto` waits for `load`, then a quiet network (nothing started or ended for 500 ms, nothing in
  flight younger than 4 s); `settle` uses the same rule.
- `drawnInView`: a connected WebGL canvas that a native observer reports out of view draws one
  frame a second (from a `clear`) instead of every frame. Skipping every draw kept webflow's
  #MadeinWebflow scene at the frame from before its pictures loaded.
- `tab.left()`: snapshots stop 5 s before the session ends; a read that ran out answers
  `too_slow` (504) instead of a second session. The second read stays for a renderer crash with
  time left.

- With breakpoints, the tablet and phone widths are read in their own tabs at the same time as
  the desktop one instead of after it (three sessions in a row before); a width whose browser
  cannot open (a 429) is left out instead of failing the import.

Discarded: making the native observer the default (45 s on Browserless before `drawnInView`, but
webflow above the fold 0.989 → 0.886 and framer 0.970 → 0.928).

Timings and fidelity per page are in the PR.
