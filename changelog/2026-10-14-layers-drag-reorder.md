# Layers: drag rows to restack

With tracks hidden from Layers (#550), dragging only worked onto track
groups, so in Design mode nothing could be reordered by hand.

`restack` in `layers.ts` maps a drop to the timeline model with the
existing doc ops (`moveTrack`, `addTrack`, `moveClip`), so undo, collab
and agent parity are unchanged:

- above/below a row: a clip alone on its track moves the whole track; a
  clip sharing a track gets a new track at the drop, same start time;
- into a group (middle of a track row): the clip joins that track;
- a group dragged above/below moves its track;
- refused: other kind (audio among visuals), nested rows, itself.

Drop place comes from the pointer: top/bottom half of a clip row, top /
middle / bottom quarter bands of a group row. ⌘] / ⌘[ keep moving to the
neighbouring track; with none that way they now create one instead of
failing. `dropLayer` is gone: `restack(..., Place.Into)` replaces it.
