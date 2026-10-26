# Morph into another shape on the canvas

Jitter-parity SH-08. The morph engine (`shape/morph.ts`, resampled rings with start-point
alignment) already worked, but the only targets the UI offered were the built-in kinds. A
hand-drawn path could be a target only through MCP, as a path string.

- `morphToClip(doc, clip, other, frame)` (`shape/ops.ts`): the other Shape clip's outline
  (pen path, star, ring, any kind) becomes the next morph target, keyed over one second from the
  playhead. Properties: Morph into shape... lists the other Shape clips. MCP: `morph_to_clip`.
- `morphBetween` now pairs contours by size, not by index. A ring whose hole was listed first
  used to grow its outer edge out of a point and stretch the hole into the disc; now holes follow
  holes and extra contours grow from a point.
- The other clip is not touched; hide or delete it when it was only a pattern.

Not done: matching several contours by position rather than size, and a corner-by-corner
correspondence (morphStart still turns the start point).
