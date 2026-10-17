# Text added to a frame is visible

Text added to a still frame (T tool or Add → Text) was invisible in the
open editor and on the closed frame, whatever its colour.

Cause: the Text template's built-in fade-in (opacity 0, y 16, 0.6 s) starts
at the clip start. Clips added to a still start at frame 0 and the still is
pinned at frame 0, so the frame showed the tween's from-state. Title (line
reveal), Shape lines (scaleX 0) and Logo had the same trap. Not the fill
stacks (#548): the paint was right, the element had opacity 0. The defect
dates from still frames (6c321fa19), made reachable by the draw tools
(4044af575, #510).

Fix: in a still doc `compose.ts` drops the template tweens not finished by
the still frame (`settledBy`). Tweens finished before it stay, so older
stills pinned past their intros compose identically. Edge transitions and
`move` tweens are untouched.

Discarded: changing the Text template (videos keep the fade); placing new
clips before the still frame (leaves Title and Logo broken).

Tests: `still-rest.test.ts`; e2e `frame-text-visible.spec.ts` (pixels in the
open editor and on the closed frame, default and recoloured).
