# Vintage TVs motion template

A pile of 4–7 old television sets (walnut, oak, cream, charcoal cabinets;
knobs, grilles, legs, antennas) in a dim room. Screens power on one by one
(line, then expand, in-out expo), play the picked media with a cathode-ray
look, switch channel once behind full static, then the camera pushes into
the largest set until its screen covers the frame for the title. Loop: the
sets switch off (collapse to a line) and the camera pulls back to the start.

- Pure function of `t` (`TVS_MODEL`), DOM + CSS + one SVG filter, no WebGL.
  Barrel curvature is a `feDisplacementMap` from a generated radial map;
  colour fringe splits and offsets R/B in the same filter. Both are props.
- Static and grain are seeded canvas noise per frame (60 Hz); the hero set
  draws it at 4x so it stays fine-grained at full zoom.
- Flicker is skipped on the title card: full-frame brightness flicker read
  as jolts in `motion-smoothness`.
- Runtime vars use the `tvs_` prefix. Discarded: three.js (a WebGL context
  for flat cabinets), a separate wide layout for landscape.
