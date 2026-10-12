# Photo strip template (step 1, draft)

Fifth hand-made template: a horizontal strip of photos moved sideways in hand-like flicks; the
card passing the centre is magnified, then shrinks as it moves on.

- **Magnifier is a function of distance.** Scale = 1 + (S−1)·(1 − smootherstep(|d|/width)); x
  offsets use its closed-form integral, so neighbours make room like a dock and never overlap.
- **Gestures fit the loop.** Gesture count = round(length / (gesture + pause)); cards moved are
  split into whole numbers summing to a multiple of the photo count, so the strip wraps and
  frame L = frame 0. Rests ≈0.45 s, always on a centred card.
- **Flick curve.** Each gesture is a beta-shaped velocity pulse (u²(1−u)⁴, closed-form CDF): fast
  rise, long soft tail, no overshoot. Pulses overlap the next one, so the strip never freezes.
- **Wrap out of sight.** Slots repeat the photos until the wrap seam is beyond the frame edge.
- **Live drag in embeds** (deterministic component, pointer and wheel): grab freezes auto time,
  release flings to a whole card, then hands back at the plan's next rest. A video render gets no
  input, so it stays a pure function of t.
- Stacked on #425 (shared `custom-template.ts`).
