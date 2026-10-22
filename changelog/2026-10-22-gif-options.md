# GIF options

The GIF export was fixed: 15 fps, 640 px, 15 s, loop forever.

- `RenderSettings.gif` (optional): `loop` forever | once | boomerang, `fps` 8-30, `width` 64-1920.
  Defaults reproduce the old output, so `settingsOf(Preset.Gif)` is unchanged. Limits live in
  `GIF_LIMITS` (`src/lib/motion/export-formats.ts`); length cap 15 s -> 30 s.
- The options travel `FarmJob.gif` -> `assembleArgs` and only change the ffmpeg step: the farm
  still renders at the doc fps and ffmpeg resamples. Once = `-loop -1`.
- Boomerang: forward then backward, one frame of each end dropped so the loop has no stutter
  (checked frame by frame with ffmpeg: 30 frames -> 58, frame n == frame 60-n). The palette is
  built once over both halves.
- UI: GIF loop, frame rate and width rows in the export dialog when the format is GIF.
  CLI `motion render --gif-loop/--gif-fps/--gif-width`; MCP `render_video` `gif` object.
- E2E `export-gif-options.spec.ts` drives the dialog on the test account (no render spent).

Not done: an exact loop count (0..1000) other than forever/once.
