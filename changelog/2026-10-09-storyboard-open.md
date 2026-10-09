# Storyboard in the brief and the editor

- `write_storyboard` returns `outline` (act, intensity, branch per beat); `pendingBoard` reads it
  from the last turn (output kept whole in the mirrored row, like `write_script`).
- `ScriptBrief` draws it with `StoryboardMini` (polyline + circles) linking the canvas.
- Editor bar: Storyboard link from `storyboardPath` on the motion node data.
