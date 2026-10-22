# APNG export

`ExportFormat.Apng`: animated PNG with alpha, like GIF but full colour.

- Farm only, same path as GIF: the VP9 master is decoded with its alpha and ffmpeg writes
  `-f apng -plays 0` (loop forever). Stored as `.png`, `image/apng`, an image asset.
- Length cap `APNG_MAX_SECONDS` = 10: every frame is a full PNG, so size grows fast.
  Frame rate is the doc's, no resampling.
- Dialog "APNG" choice; CLI `--format apng`, MCP `render_video` format text.
- Checked: ffmpeg output has `acTL` with 30 frames and 0 plays, rgba; dialog in Chromium
  (`export-apng.spec.ts`). No farm render was run.

Not done: loop count other than forever, frame-rate or width options.
