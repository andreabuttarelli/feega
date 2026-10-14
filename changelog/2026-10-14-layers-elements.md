# Layers: elements, not tracks

Users read the Layers tree as Figma's: one row per element. It listed
timeline tracks ("Video 1", empty "Audio 1") as rows, and frame rows
showed a generic clapperboard.

- `layers.ts`: tracks are not rows. Empty tracks vanish, clips sit
  straight under the frame in track order. Only in Motion mode
  (`EditMode.Motion`, published by the editor) a track holding more than
  one clip becomes a group, named by its owner's name, else its clip
  labels, else "Track n". Stored outlines of closed frames are built in
  Design mode, so they never group.
- A custom clip, a clip with tagged parts, or a locked template is a
  `Group` row (component icon). Lock stays disabled only for templates.
- Frame rows carry `thumb` (the node's `posterAssetId` URL, lazy `<img>`)
  and a still/video icon (`MotionFormat.Poster` = still).
- Discarded: grouping tracks in Design mode too — time order only matters
  where time is edited. Dropping a clip on a clip (no track row left) is
  not wired: drag still targets track groups only.
- Hide/lock use the shell `IconButton` (#539). Rows stay hand-built:
  `Row` has no slot for the fold, thumbnail or rename input.
