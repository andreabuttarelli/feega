# The GPU display list draws keyframed masks and modifiers

`keyframedOutside` refused any clip with a keyframe whose source the
display list did not sample, so a keyframed `maskWidth` or
`mod.<id>.copies` kept the whole frame on its poster (4 of 57 frames on the
heavy canvas copy).

Masks were already sampled in `maskLayers`; only the refusal was wrong.
Modifier params are now sampled with `lookAt`, the same function the HTML
renderer uses, so both read the same copies at the same frame.
