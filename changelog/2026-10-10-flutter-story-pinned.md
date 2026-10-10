# Flutter scroll story pinned in the same frame

Measured the SDKs against the plain `<feega-motion>` embed (Saturn scrub, fd37 particles).
React: no overhead — same fps, same ≤1 `feega:host` message per frame, zero long tasks; only
+71 KB gz of React. Flutter: Dart build/raster under 0.5 ms on macOS, but the scroll story was
pinned a frame late.

- Before: `_measure` ran post-frame and `setState` moved a `Positioned`. In the scrolled frame the
  WebView travelled with the page, then snapped back next frame (trailing jitter), and the player
  subtree rebuilt every scroll frame.
- Now `StoryStage` (`story_stage.dart`) is a render object that offsets the stage at paint time
  from its position in the viewport, repainting on scroll. No rebuild; `setState` only when the
  viewport height changes.
- Test: `test/story_stage_test.dart`, with a fake `WebViewPlatform`. Red before: stage at -100 px,
  28 rebuilds in 30 scroll steps.
- Android emulator raster during scroll (~6-8 ms avg) is the platform view's cost; unchanged.
- Numbers: `~/Documents/feega-videos/sdks/perf/numbers.md`.
