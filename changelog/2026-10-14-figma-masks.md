# Frames: Figma-style "Use as mask"

Frames had per-clip AE masks and track mattes, but not Figma's gesture:
draw a shape, select it with the layers above, use it as mask.

Model (ADR 0009): a track matte with a named source. New optional clip
field `matteFrom`; when set, `matteSource` returns that clip instead of
the clip on the track above. No new renderer: the matte runtime already
snapshots the source as drawn, so radius, smoothing, paths, gradient
alpha (soft masks) and keyframes all mask as rendered, in preview,
still and video alike. Discarded: a mask-group precomp (ids and coords
change on every mask/unmask), an SVG mask from geometry (a third system
that would drift from how shapes draw), a member list on the mask.

- `mask-group.ts`: `useAsMask` (bottom-most selected is the mask),
  `releaseMask(s)`, `joinMask`, `leaveMask`, `maskMembers`.
- Masking on/off = the mask's `hidden`: hidden clips leave the doc
  before compose, the pair loses its source, members draw whole.
- `setTrackMatte(none)` also clears `matteFrom`.
- Layers: `LayerKind.Mask` row (contrast icon), members indented under
  it; `dropLayer` wraps `restack` and joins/leaves the mask by drop
  target; right-click menu with Use as mask / Remove mask.
- Editor: ⌃⌘M (`ctrlCmd` on `KeyPress`), Layer menu entries.
- Agent/MCP: `use_as_mask`, `release_mask` (`motion_tool`); parity rows.

Limits: top level of a frame only (not inside a precomp); a mask that
ends before a member leaves it blank; moving the mask row does not carry
its members.
