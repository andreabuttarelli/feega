---
title: Point tracking and stabilising
description: Follow a point through a video clip, attach the motion to another layer, or hold a shaky shot still.
sidebar:
  order: 3
---

Tracking finds one point of a video in every frame and turns its path into `x` and `y` keyframes. Use it to pin a label, a sticker or a graphic to something that moves, or to cancel the shake of a handheld shot.

## Track a point

1. Select a video clip. A **Track point** section opens under the timeline bar.
2. Move the playhead to a frame where the point is easy to see, then click it on the picture. A solid box shows the feature that is matched, a dashed box how far it may move between two frames.
3. Set **Feature size**. Pick something with texture inside the box: a corner, a logo, a knot in wood. A flat colour cannot be tracked.
4. Press **Track forward**, **Track backward** or **Track both ways**.

The tracker compares the patch around your point with the next frame, on brightness only, coarse to fine, and runs in a Web Worker so the editor stays responsive. If the match falls below half, it stops and says how many frames it followed; place the point again on a later frame and track from there.

## Attach it to a layer

Choose a layer in **Layer**, set an **Offset** in px if the layer should sit away from the point, and press **Apply to layer**. The layer gets `x` and `y` keyframes on the tracked frames, linear between them. Keys outside the tracked span are kept; keys inside it are replaced.

The video is assumed to fill the frame. Tracked positions are measured from the centre of the frame, like any other `x` and `y`.

## Stabilise

**Stabilise video** applies the opposite of the path to the video clip itself: the tracked point stays where it was on the frame you placed it. The picture moves instead, so scale the clip up a little to hide the edges.

## From the chat agent and MCP

- `track_point` takes `clip_id`, `time` (seconds from the clip start), `x` and `y` (px of the frame), and optionally `from`, `to`, `feature` and `search` (px). It decodes the frames on the server with ffmpeg, runs the same tracker and returns a `track_id`.
- `apply_track` takes the `track_id`, a `target_clip_id`, `mode` (`follow` or `stabilise`) and `offset_x` / `offset_y`.

The track is saved with the video, so `apply_track` works in a later call, including from the CLI. The last 20 tracks are kept.

```bash
feega motion tool <nodeId> track_point --input '{"clip_id":"abc","time":0,"x":960,"y":540}'
feega motion tool <nodeId> apply_track --input '{"track_id":"<track_id from the first call>","target_clip_id":"def","mode":"follow"}'
```

The server reads frames at the clip's own pace. A clip with reverse, or with time remap keyframes, cannot be tracked there: clear the remap first. The browser tracks those clips as they play.
