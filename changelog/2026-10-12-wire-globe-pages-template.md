# Wire globe pages template

Hand-made template: a thin lat/long wireframe sphere turns slowly; pictures and video are
bent onto it as curved pages (overlapping, rolled), the back side seen dimmed through the wire.

- WebGL (one `three.renderer`): pages must bend in both directions and occlude the back
  hemisphere with depth; CSS 3D gives flat tiles only (that is `image-globe`).
- Each page is a 20x20 grid mapped through the tangent plane onto its own radius, so overlaps
  never z-fight. Geometry is built once; per frame only the group rotation changes.
- Monochrome, contrast and brightness in the page shader; back faces mix into the background.
- Loops: integer turns at constant speed, axis sway is one sine period per loop. No entrance.
- Sources are hidden `<img>/<video>` in the DOM so the player waits for them before frame 0.
