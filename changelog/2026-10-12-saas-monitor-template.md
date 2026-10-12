# SaaS monitor motion template

Built-in `builtin:saas-monitor`: a studio display rises into a 3/4 pose over a
lavender-to-violet gradient and an oversized background word; its screen shows a
recreated website that types its headline, hovers its CTA and scrolls to a purple
product section. Loops: the monitor leaves the way it came.

- One three.js renderer draws the physical monitor: aluminium PBR body with a
  bevel and rounded corners, thin black bezel, angled slab arm, slab foot, shadow
  catcher plus baked contact shadows. Light: PMREM of a procedural studio room
  (custom components cannot load the `/motion-env` HDRs), hemisphere tinted with
  the accent, one shadow-casting key and a front fill.
- The screen stays DOM: each frame the site is mapped onto the four projected
  screen corners with a `matrix3d` homography, built at 2x for sharp text.
  Discarded: CSS 3D faces (looked like a flat cutout) and HTML-to-texture (soft
  text).
- Moves are pure in-out expo; the drift is one sin² swing (±3.5°) over the loop,
  so the seam and the watermark parallax match.
- Screen source: built-in site or a picked picture/video. A recreate_ui
  component as screen is not wired.
- Prop `leave`, not `loop`: the lint reads `p.loop` as a p5 sketch.
- Watermark size follows the short side of a 16:9 box, so 9:16 and 1:1 keep it
  partly hidden and just wider than the frame.
- Farm cost of the WebGL frames not measured (SwiftShader on the farm).
