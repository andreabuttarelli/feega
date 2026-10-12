# Scatter title template

Built-in `builtin:scatter-title`: 12 flat, sharp cards of varied aspect scattered around a centred
lowercase title, drifting outward with slight scale (depth), staggered centre to edge, title via
the shared word entrance. Loop: everything leaves in the last 1.6 s, so t=0 and t=end are the same
empty frame.

Decisions:
- Layout is a hand-placed table traced from an editorial ad reference, not a generator; portrait
  transposes it, square shrinks cards. A pure model clears the measured title box and separates
  overlapping cards.
- CSS only, no rotation, no blur, expo in-out moves, no overshoot.

Discarded: the floating-media 3D/tilt path (the reference is flat).
