# Motion mode: canvas edits key, paths, onion skin, sound

Issue #1517, after #1536.

- Canvas drag/resize/rotate in Motion went through `writePatch`, which keyed only a property that
  already had keyframes; otherwise it changed the resting value — so a first move recorded nothing.
  Now an unanimated property starts a track: start value held at the clip's frame 0, edit keyed
  at the playhead. Anchor stays a resting value (pivot reads `transform`, not keyframes).
- Motion paths: `MotionPathOverlay` drew only `clip.path`. It now falls back to `positionTrail`
  (x/y keys sampled per frame). Overlay rule in `frame-tools.ts` shows it only in Motion.
- Onion skin: `OnionOverlay` in the same `FrameTools` layer, reusing `outlinePaths` at the
  nearest previous/next keyframe. Toggle `onionSetting` in the timeline bar, Motion only. No new
  renderer.
- Voice-over/music: `ModeSpec.sounds`; `SoundSection` in the frame panel (no selection) opens the
  same `FrameDialogs` via `frameProperties.runAction` (`frame-voice`, `frame-music`). The "…" entries stay.
- Drawing in Motion already created base values; a test now pins it.
