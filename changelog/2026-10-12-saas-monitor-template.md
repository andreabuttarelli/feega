# SaaS monitor motion template (draft)

Seventh hand-built template: a desktop monitor rises into a tilted pose over a
lavender-to-violet gradient and an oversized background word; its screen shows a
recreated website that types its headline, hovers its CTA and scrolls to a purple
product section. Loops: the monitor leaves the way it came.

- CSS 3D (boxes of faces in preserve-3d), not three.js: crisp vector text on the
  screen and cheap on the farm, where WebGL runs on SwiftShader (LESSONS). Cost:
  materials and reflections are gradients, not PBR.
- Moves are pure in-out expo; the drift is one sin² swing over the loop, so the
  seam and the watermark parallax match.
- Screen source: built-in site or an asset (id/link, `video:` prefix). A
  recreate_ui component as screen is not wired yet.
- Prop `leave`, not `loop`: the lint reads `p.loop` as a p5 sketch.
- Stacked on `motion-template-feature-scroll` (#425/#426 unmerged).
