# One-click In/Out presets on a layer

Animating a layer in or out took four fields in "Animate to" (property,
target, length, ease). The inspector now has an In / Out block: pick a side,
pick where it plays (clip edge or playhead), click a preset.

Presets live in one registry table, `IN_OUT_PRESETS` in
`src/lib/motion/in-out-presets.ts`: fade, slide up/down/left/right, scale,
blur, pop, and typewriter (text clips, In only). Each row names the tracks it
moves and where they start hidden; the engine (`applyInOut`) keys hidden ->
resting value for In, resting -> hidden for Out. The resting value is read
from the nearest key outside the span, so re-applying a preset never bakes a
half-finished curve into the layer.

Decisions:
- Ease is always `standard` (expo in-out with a soft settle). Overshoot,
  elastic, bounce and linear were discarded: off-style for entrances.
- Slide direction on Out is the direction of travel (slide up out leaves
  upward), mirrored from In.
- Typewriter reuses the text animator preset instead of a second
  implementation.
- Agent parity: motion tool `apply_preset` (clip_id, preset, side, duration,
  at). The MCP inventory is unchanged: motion tools run through `edit`.
