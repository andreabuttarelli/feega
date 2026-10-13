# Wire globe pages template

Hand-made template: a thin lat/long wireframe sphere turns slowly; pictures and video are
bent into curved pages stacked on nested shells inside it (overlapping, rolled), the back side
seen dimmed through the wire.

- WebGL (one `three.renderer`): pages must bend in both directions and occlude the back
  hemisphere with depth; CSS 3D gives flat tiles only (that is `image-globe`).
- Each page is a 20x20 grid mapped through the tangent plane onto its own radius, so overlaps
  never z-fight. Geometry is built once; per frame only the group rotation changes.
- Monochrome, contrast and brightness in the page shader; back faces mix into the background.
- Loops: integer turns at constant speed, axis sway is one sine period per loop. No entrance.
- Sources are hidden `<img>/<video>` in the DOM so the player waits for them before frame 0.
- Pages sit on levels from radius 0.38 to 0.95 (one level each, a stride coprime with the count
  spreads neighbours apart), so rotation shows parallax and front pages occlude deeper ones.
  First draft put all pages on one shell just under the wire: read as a flat skin, not a volume.
- Deeper pages span a wider angle (1/sqrt(r)) so they stay legible; a depth fog darkens the far
  half so the levels read.
- Second draft (one level per page, overlapping, 1/sqrt(r) sizing) piled pages into touching
  clusters with a dense core. Now three shells (0.95, 0.76, 0.57), pages dealt round-robin,
  Fibonacci per shell, each shell offset. Size comes from the shell's nearest-neighbour arc, so
  pages on one shell never touch at any count or page size.
