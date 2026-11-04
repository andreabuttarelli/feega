# Browser renders run in a background tab; a stretch renders alone

A render on `/render/<token>` stalled in a background tab (12/900 frames, "about 1527 min
left"). Two causes: `visibleGate` paused every frame until the tab was visible again, and
the HTML capture runtime waited two `requestAnimationFrame`s per frame, which a hidden tab
never fires. The gate is gone (the wake lock stays); `nextFrame` resolves at once when the
document is hidden. Layout and computed styles are read synchronously by html-to-image, so
skipping the paint does not change pixels. The gpu-core path had no rAF and was blocked by
the gate alone.

Range: `render_video` (MCP and in-app agent), `POST /api/v1/motion/<id>/render` and
`feega motion render --from/--to` take a stretch in seconds. It is stored on the link run
(`params.range`), and the render page slices `frameTimes` to it, so a single frame goes
through the exact export pipeline instead of the server snapshot renderer (`view` snapshot,
which is a different renderer). Range renders are silent and browser only: mixing a
sub-range of the audio was not worth it for a check. Rejected: a PNG still output; the
MP4 from the same encoder is the honest comparison.
