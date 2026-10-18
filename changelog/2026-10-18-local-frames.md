# view_frames works locally

`view_frames` and `POST /api/v1/motion/<id>/frames` answered "frames unavailable" on a local
server: `serverFramesOpen()` needs `VERCEL` or `CHROMIUM_PATH`. Setting `CHROMIUM_PATH` to a Mac
Chrome still failed, because the serverless flags of `@sparticuz/chromium-min`
(`--single-process`, ...) crash a desktop Chrome at launch.

- A `CHROMIUM_PATH` browser launches with puppeteer's defaults; the downloaded pack keeps its
  flags. An empty `CHROMIUM_PATH` now means unset.
- The tool note and the endpoint's `closed` detail name `CHROMIUM_PATH` (`FRAMES_CLOSED_HINT`).
- The feega skill documents the env.
