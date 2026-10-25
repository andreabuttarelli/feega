# Demo recorder for feature videos

New rule: every feature ships with a short screen-recorded demo for
socials. `scripts/demo-record/` makes them from a Playwright script.

- `demo(page, dir)` (demo.ts): `click`, `type`, `drag`, `select`, `key`,
  `move`, `wait`. The mouse moves on an expo in-out path, hovers 0.9 s
  before each click, and every position is logged; shortcuts show a key
  badge (badge.ts). Frames come from a CDP screencast at DPR 2 (headed Chromium:
  headless screencast returns 1x frames); clicks, typed field rects and
  drags go to an event log.
- camera.ts turns the log into keyframes: ~2.1x toward each click, fit
  each typed field (1.8-2.5x), fit each drag (or a given `fit` rect),
  expo in-out, hold, ease out when idle > 2.4 s. Portrait uses half the
  zoom so context stays in frame. Unit tested.
- render.ts crops/scales each frame with sharp into 1920x1080 and
  1080x1920, adds a lowercase semibold title card and the untouched
  feega icon end card, crossfades with ffmpeg. Output:
  `~/Documents/feega-videos/demos/<date>-<slug>-{16x9,9x16}.mp4`.
- demos/*.demo.ts: eight demos on the e2e session fixture (test@dazero.co,
  disposable project, model spend refused).

Run: `E2E_REAL_STACK=1 E2E_BASE_URL=http://localhost:<port> node
--env-file=.env node_modules/@playwright/test/cli.js test -c
scripts/demo-record/playwright.config.ts [name]`. Re-render a recording:
`npx tsx scripts/demo-record/rerender.ts <dir> <slug> "<title>"`.

Discarded: ffmpeg zoompan/sendcmd camera (integer jitter, hard to test),
Playwright recordVideo (low bitrate).

Raw recordings (frames, event log, contact sheets) go to
`~/Documents/feega-videos/demos/raw/<slug>-<ts>/`, not a temp dir.

Smoothness: the screencast delivers page frames only on repaint (~22 fps
while moving, median 45 ms). The cursor, click ripple and camera are
therefore drawn in post from the logged pointer path (pointer.ts) at
60 fps, and each frame is cropped at sub-pixel precision (oversized
integer crop, resize, then output-pixel crop) so camera moves don't
jitter. No frame interpolation. End card: lowercase "feega" wordmark.

Seeds are realistic (seed.ts `heroDoc`: a ceramics landing hero with
title, subtitle, CTA, product photo from static/templates, press row;
Figma paste builds a profile card), never plain coloured frames.

`look(rect, ms)` holds the camera on an area without moving the mouse
(used while a combined video plays). The combine demo seeds the three
Orbit launch scenes from tests/e2e/canvas-scenes-scrub.spec.ts.
