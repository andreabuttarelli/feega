# Glass tiles wall template

A curved wall of glossy glass tiles (picture or video, title, caption) on a
sphere section; the camera pans across it in expo in-out moves with a slow
tilt breath, and the loop closes exactly.

- One three.js renderer (one WebGL context). Each tile is an extruded,
  bevelled rounded slab with a transmissive MeshPhysicalMaterial over a
  media face set inside it: real thickness, refraction and specular from a
  baked studio environment. The first draft was CSS 3D with gradient bevels;
  it read flat, so it was replaced.
- Titles are drawn into the face texture at 1024 px wide, so they stay
  crisp and are refracted with the picture, like text under real glass. A
  projected DOM overlay was discarded: it would sit on top of the glass.
- Tiles sit at staggered depths (stable per picture, so the loop closes) and
  the camera orbits a few degrees, so thickness and perspective read.
- Default copy is original, not the reference's.
- Each DOM tile keeps its media for the whole loop: slots wrap on a period
  that is a multiple of the columns crossed per loop, so nothing swaps `src`.
- Rounded corners are allowed here: the tile is user content.
