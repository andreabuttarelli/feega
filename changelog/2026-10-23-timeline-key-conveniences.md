# Timeline conveniences: mute, select related, marquee, duplicate

Jitter-parity AN-03, AN-04 and AN-05. The timeline could move and ease keyframes but not
select them by area, copy them, or silence one lane to compare.

- Mute (`clip.mutedLanes`, `setLaneMuted`): an eye on each animation lane. `withoutMutedLanes`
  (`playback.ts`) strips muted lanes in `shownDoc`, the one function both the GPU painter and the
  export pass through, so preview, GPU and render agree and the keys stay in the document.
- Select related (Cmd/Ctrl+Enter, `relatedSelection`): selected layer -> its keyframes (lanes
  open); selected keyframes -> their layer. Local to `MotionTimeline`, not a global `Command`:
  the registry keys are layer-level and this one only means something while a timeline is open.
- Marquee (`marqueeHits`): dragging over lanes selects the keyframes it touches (Shift or Cmd to
  add). A drag that starts on an ease segment still opens the picker on a plain click.
- Duplicate (Cmd/Ctrl+D with keyframes selected, `duplicateKeyframes`): copies land after the
  last selected key, 15 frames on, spacing kept. Without keyframes selected Cmd+D still
  duplicates the layer. `KeyBoard` now carries `intensity` so a pasted elastic key keeps it.
- MCP: `edit_lane` (mute, unmute, duplicate); `mutedLanes` is in `get_motion_doc`.

Not done: grouping timeline segments (AN-11), snapping to the playhead (AN-06).
