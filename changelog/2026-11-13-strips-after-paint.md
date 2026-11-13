# Auto layout strips follow the edit after the frame that draws it

`AutoLayoutOverlay` recomputed its strips (`layoutStrips`) in the same effect flush as the edit,
about half of the ~11 ms flush between a key and the patched paint. It now keeps the painted doc
and takes the new one through `afterPaint` (prop from `GpuFlow` via `FrameTools`).

- Edits from the overlay still apply to the live `doc`, never the painted one, so a drag started
  right after a nudge cannot drop it.
- During a strip drag the strips follow the drag at once, as before.
- In the patched frame the strips show the previous layout; from the next frame they agree.
- Without a painter (the read-only view) the strips follow at once.
- Not done here: selection colours, selection marks, frame bar actions.
