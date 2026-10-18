# Inline play joins the release gate

A regression report said Space left a frame stuck between frame 0 and 1,
only on interactive template frames. canvas-inline-play covered only a
plain video doc, and ran outside `npm run test:gate`.

- The spec now plays three docs: the plain video, a template frame
  (stack-words, autoplay with runtime vars) and an interactive one
  (scroll-story, scrub), each as inserted from the canvas (Precomp).
- It is in `test:gate` and in the `webkit-perf` project, so Safari runs it too.

All 12 cases pass on dev d2095146a in Chromium (headless and headed) and
WebKit, also with Interactive preview on. The report did not reproduce, so
no fix ships here.
