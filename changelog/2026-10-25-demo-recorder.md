# Demo recorder for feature videos

New rule: every feature ships with a short screen-recorded demo for
socials. `scripts/demo-record/` makes them from a Playwright script.

- `demo(page, dir)` (demo.ts): `click`, `type`, `drag`, `select`, `key`,
  `move`, `wait`. A DOM cursor (cursor.ts) follows the mouse, which moves
  on an expo in-out path, never teleports; clicks ripple; shortcuts show a
  key badge. Frames come from a CDP screencast at DPR 2 (headed Chromium:
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
