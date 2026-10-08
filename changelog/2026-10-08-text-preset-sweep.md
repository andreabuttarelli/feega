# Text presets sweep over the text's real units

**Before.** `applyPreset` keyed the selector offset to fixed numbers (`line-mask-up` -45→140).
A unit moves only while the sweep crosses `softness` around its position, so a one-line title
moved during ~22% of the span: on a 0.6 s reveal, parked 1.2 em low, then 370 px in 3 frames
at 24 fps. Measured on the generative showcase (`code.`, frames 6–8).

**Now.** The sweep is fitted to the units the clip's text has: it starts `softness` before the
first unit and ends on the last. One line moves for the whole span; staggers lose dead time at
both ends. Test: a one-line mask-up never jumps more than 15% of its travel per 1/24 of span.
