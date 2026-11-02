# Component dropped on the canvas hugs the instance

Dragging a component from the Components panel onto empty canvas made a
free element as big as the main's home frame: `placeInstance` adds a
Precomp clip with no own width/height, so `elementBox` fell back to the
whole frame and `landFree` sized the node to the set frame's stage (tall
Components set frames → near-infinite height, transparent wrapper).

`planComponent` now measures the instance with `shownBox`, builds a doc
the size of that box, copies the main into it reframed and shifted so its
content starts at the origin, and scales the stage by the same ratio. The
free element is exactly the instance, centred on the drop point. The
optimistic client path uses the same planner.

Not covered: mains with their own `comp.frame` (Lottie, agent-made comps)
are not shifted by `reframed`; they keep the previous behaviour.
