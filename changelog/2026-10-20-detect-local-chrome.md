# Local Chrome is found without CHROMIUM_PATH

`serverFramesOpen()` was true only with `VERCEL` or `CHROMIUM_PATH`, so a dev server on a laptop answered `server_frames_unavailable` for agent turns, exports and stills even with Chrome installed. Outside Vercel it now looks for Chrome, Chromium or Canary at the usual macOS and Linux paths (`localChromium` in `chromium-frames.ts`). `CHROMIUM_PATH` still wins; with no binary found the remote fallback from #1039 applies.
