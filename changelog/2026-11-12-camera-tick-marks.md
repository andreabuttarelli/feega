# Canvas: camera ticks stop re-running the frame graph

`waiting` and the `data-posters` expression in `CoreFrames.svelte` re-ran on almost every pan tick
although none of their inputs changed. Cause: a Svelte derived that recomputes to an equal value
keeps its old write version, so after one real input change it reruns on every later dirty mark,
and four deriveds that read `view` (`tier` in `CoreFrames` and `GpuFlow`, `labelZoom`, `liveCode`)
marked the whole card and frame graph on each tick. They are now `$state` written by
an `$effect`, which changes only when the step or the visible set changes.

Also in this change:

- `seenOverlays` (now `seenIds`) re-queries the cull index only when the view leaves the slack
  region it was taken with (`stillHolds`, as `CoreFrames` does for its sight), not per tick.
- Card labels: a card out of sight keeps the label step it was drawn at (`labelStepOf`); only
  cards in sight take each new step. Before, every one of the 8 steps per octave redrew the
  labels of every card.

Rejected: moving `view` out of `$state` in `GpuFlow` (~130 references) — at the measured cost per
tick it does not pay for its risk. Upgrading Svelte: 5.57.3 behaves the same.
