# Still frames: design defaults

- `addClip` (timeline.ts) spans a clip over the whole doc when the doc is a still
  (`CLIP_SPAN`, keyed on `DocMode`). Before, only drawing did (`SPAN` in draw-create.ts);
  `add_clip` and the component library placed 3 s clips at the playhead.
- `designStill` (still.ts) turns a video into a still and swaps the default brand background
  for transparent; a still re-pinned keeps its background. Used by `set_canvas` with `still`
  (an explicit `background` still wins) and by the Still checkbox in Composition settings.
  `export_still` keeps `setStill`: pinning a video frame for export must not change its look.
- Entrance reveals on Title/Text need no change: the renderer already drops tweens not settled
  by the still time (`settledBy` in hyperframes/compose.ts).
- `DocMode`/`docMode` moved to doc.ts (separate commit) so timeline.ts can read them without a
  cycle through still.ts.
