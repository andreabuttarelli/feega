# Point tracking and stabilising (T7, first slice)

Pinning a graphic to a moving thing in a video meant keying x/y by hand, frame by frame. Now one point is tracked and the path becomes keyframes.

- `packages/motion-core/src/motion/tracking/`: `point-tracker.ts` (normalised cross-correlation on luminance, 3-level pyramid, coarse search then ±2 px refinement, parabola sub-pixel, constant template from the reference frame or re-taken each frame with `Adapt.EachFrame`), `track-clip.ts` (`trackClip` samples the clip's source time with `sourceSeconds`, so speed, trim, reverse and remap are honoured; `applyTrack` writes linear x/y keys), `luma.ts`. Pure: no DOM, no ffmpeg, no `$lib`.
- Two frame readers behind one port (`LumaReader`): browser (`browser-lumas.ts`, mediabunny `CanvasSink`, run in `track.worker.ts` through `track-job.ts`) and server (`server/motion/track-frames.ts`, one ffmpeg call, gray rawvideo at up to 480 px).
- UI: `TrackPanel.svelte` under the timeline for a selected Video clip. Place a point on the playhead frame, Track forward/backward/both, Apply to layer (with offset) or Stabilise video.
- Agent: `track_point` and `apply_track` in `motion-tools.ts`. `track_point` is a read tool for the MCP editor path. The track lives in the session, so `apply_track` must run in the same turn or batch.

Decisions:
- Positions are fractions of the frame measured from the centre, the same as stored x/y. The video is assumed to fill the frame; a cropped or scaled video clip drifts by the crop.
- Stabilise moves the video by the inverse path relative to the anchor frame. No smoothing, no rotation or scale (that is a two-point track).
- The template is not updated by default: a drifting template is worse than a lost point, and losing the point is reported (`lost`).
- Server ffmpeg needs evenly spaced frame times, so a reversed or remapped clip is refused there and tells the agent to clear the remap.
- Tests use a synthetic moving square: drawn in-memory for the tracker, encoded by ffmpeg for the server reader.

Discarded: a WGSL tracker (the CPU one costs about 100k multiply-adds per frame at 480 px), two-point and corner-pin tracking, a mask-following option. Next slices.

## Tracks survive between calls

`track_point` used to keep its result in per-call session state, so `apply_track` from a separate `feega motion tool` call found no track. The result is now saved on the doc (`pointTracks`, last 20) and `track_point` is a write tool.
