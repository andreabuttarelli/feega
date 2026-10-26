# Scene crossfade was a hard cut

**Before:** `junctionMoves` decided which clip fades (incoming rises over, or outgoing fades
under) from the clip order inside the scenes track. Flattening a scene group reverses that
order, so the incoming scene sat on top, the outgoing one faded underneath, and the export showed
a cut. The shape and the text looked different only because text has its own intro.

**Now:** the stacking is ranked on the flattened doc (`flattenComps`), in both the HTML compose
and the display list. Also in the GPU path: transition opacity is clamped to 0..1 (the ease
settle went to -0.01), dip to black darkens with a brightness filter (`dim` pose), and a wipe
can reveal from the left (`wipeLeft`).

**Tests:** `scene-transitions.test.ts` (top scene fades, clamp, dip, wipe) and the e2e
`canvas-scenes-sequence.spec.ts`, which decodes the exported MP4 mid-fade and expects blended
pixels. The export dialog renders with the HTML engine; GIF there is a server render and was not
run (farm cost).
