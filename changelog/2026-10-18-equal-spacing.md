# Equal-spacing guides on the canvas

Snap guides (#737) aligned edges and centres only. `equalSpacing` finds the
nearest facing tile on each side of the dragged box; within reach it centres the
box in the gap and returns both gaps, drawn by the measure layer with labels.
An edge closer than the equal position wins.

Compared with an MIT snapping module evaluated for porting: it matches centres only
to centres and draws guides from the pre-snap box; ours stays as is, nothing copied.
