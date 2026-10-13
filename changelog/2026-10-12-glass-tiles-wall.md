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

## Round 4: real glass, tall panes

- The slab was additive black glass with a painted Fresnel/warp shader on
  the face: it read as CG. Now the slab is a transmissive
  MeshPhysicalMaterial (ior 1.5, roughness 0, light dispersion, clearcoat)
  and the face is a plain textured mesh inside it; refraction through the
  wide bevel is what bends the picture at the edges.
- `scene.background` is the background colour: three clears the
  transmission buffer to half-white when the canvas is transparent, which
  made every rim milky.
- Side tiles darken through the slab colour and reflect more of the
  environment (narrow bright strips, dark room); thickening the slab per
  tile was dropped, it produced a washed double image.
- Default tiles are portrait (aspect 0.72, width 0.25 of the short side)
  in every format.
