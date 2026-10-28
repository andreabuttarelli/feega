---
title: Timeline
description: Playback, work area, markers and keyframe handling.
sidebar:
  order: 1
---

| Key | Does |
|---|---|
| `Space` | Play / pause |
| `J` / `K` / `L` | Rewind one second / pause / play |
| `←` `→` | Previous / next frame (Motion mode); `Shift` jumps 10 frames |
| `Home` `End` | Go to start / end |
| `I` `O` or `B` `N` | Work area starts / ends here |
| `⌥↵` | RAM preview: cache the work area so it plays at full speed (see [Video playback](/motion/video-playback/)) |
| `M` | Add a marker |
| `Shift+J` `Shift+K` | Previous / next keyframe |
| `[` `]` | Move the clip to start / end here |
| `⌥[` `⌥]` | Trim the clip start / end to here |

## Loop

Videos loop by default: the timeline preview and the embed wrap from the last frame to the first; an MP4 is as long as the video, so a seamless ending matters when a feed replays it.

- **Loop button** (next to play): turns looping on or off. Off, playback stops at the out point and the embed plays once.
- **Loop region**: the bar on top of the ruler. Drag its start or end handle (or press `B`/`N`, or `I`/`O` in Animate mode, at the playhead) to loop just that part while you work. The clear button resets it to the whole video. At least 0.5 s.
- **Make seamless** (∞ button): every prop animated across the loop end gets a closing keyframe there with its first value, so the last frame flows into the first with no jump. Keys past the end are dropped.

The motion agent does the same with `set_interactive` (`loop`), `set_work_area` and `close_loop`.

Timeline conveniences:

- Drag over the timeline to select keyframes, then duplicate with `Cmd+D`.
- Mute an animation lane to compare with and without it.
- `Cmd+Enter` jumps between a layer and its keyframes.
- Select several segments and Group them into one that moves as a unit.
- Dragging a keyframe shows a snap guide when it locks onto another key, clip edge, marker or the playhead.
- Comments pinned at a moment show on the timeline.
- Videos run and export at up to 120 fps (rendered on servers). **Unverified:** the frame-rate list in the editor; see `FRAME_RATES` in `src/lib/motion/design.ts`.

All shortcuts: [Keyboard shortcuts](/reference/generated/shortcuts/).
