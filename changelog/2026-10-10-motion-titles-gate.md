# Tight stacked titles, safe area as a note, gate catches dead transitions and black tails

**Titles.** The word burst placed its lines 0.2 of the frame height apart, designed in 16:9. In
16:9 that is 1.11x the type size, in 9:16 1.98x: the "huge line-height" of the v2 trailer (its
Title clips had leading 1, the gap was the stack). Now the pitch is size x 0.95 and
`insertTemplate` squeezes text clips' y (and y offsets, height) toward the centre when the target
frame is taller than the template's, so a stack keeps its leading in every format.

**Safe area.** `OutOfFrame` is a warning: it no longer blocks delivery or drives self-check loops.
A `bleed` declared on a Precomp now covers the clips inside it (the agent set it on the scene,
the check read the words, and looped).

**Gate.**
- `DeadJunction` (blocking): a junction whose clip before no longer ends at the cut never plays;
  v2 had three (push-left 7 s, blur 15 s, crossfade 24.5 s) that rendered as hard pops.
- `TrailingEmpty` tolerance 0.5 s → 0.2 s: v2's 15-frame black tail sat exactly on the old limit.
- Scene ending mid-entrance: already covered by `CutMidAnimation`; v2's blurred last word was a
  `view_frames` sample during the 6-frame entrance, not the cut.

**Template.** The UI explode dimmed its grid with a snap ease: a one-frame jump at 22.5 s. Now a
standard ease over a beat; a test runs `motionJolts` on every launch template's opacity.
