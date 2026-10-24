# Scene transitions move the whole scene

**Before:** the GPU canvas ignored junction transitions. A crossfade faded the DOM text of a
scene while its shapes stayed at full opacity.

**Now:** `junctionMoves` (`junctions.ts`) turns a junction into per-clip moves, shared by the
HTML compose (GSAP tweens) and the display list. `drawFrame` combines a clip's own edge pose
with its junction pose and the poses of every enclosing Precomp group (`enclosingGroups`: the
`span` tracks that follow a group), so opacity, push, zoom, blur and wipe reach every flattened
child. `blur` in an edge pose now reads only `blur(...)` filters.

**Gap:** dip to black's brightness ramp has no pose, only its opacity cut. Wipe's
below variant (reveal from the left) is not drawn.

**Tests:** `gpu-full/scene-transitions.test.ts` samples mid-transition for crossfade, push,
zoom, blur.
