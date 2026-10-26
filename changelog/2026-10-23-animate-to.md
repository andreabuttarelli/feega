# Animate to

Jitter-parity AN-01. Moving a value over time meant adding two keyframes by hand and typing the
start value.

- `animateTo(doc, clip, targets, span)` (`animate-to.ts`): per prop, key the value the prop has at
  the start (a running animation is continued) and the target at start+duration. Keys inside the
  span are replaced, keys outside are kept. The ease sits on the created segment.
- Properties, Animation: an Animate to row (property, target in the units shown elsewhere, length,
  ease). It starts at the playhead.
- MCP: `animate_to` takes several props at once, in the units of `set_transform`.

Discarded: Jitter's "operation" model that replaces keyframes. This is sugar over keyframes
(O-04); the timeline still shows and edits the two keys.
