# Perspective stack and poster deck become card snakes

User feedback on #603: the perspective stack "lost" the card coming forward, and the poster
deck only rotated in place. Wanted: cards moving like little snakes through 3D space.

- Cause of the vanishing card: by design the front card tipped toward the viewer and faded to
  opacity 0 during the flip, so the card that came forward disappeared. Gone with the rework; a
  test now fails if any card's opacity drops or it passes the camera.
- Both now use `snake-chain.ts`: a few chains, each on a closed 3D Lissajous path; the leader
  advances in eased surges (glide, one per ~3 s), every card follows with a path offset and a
  small time lag. Periodic in the clip length, so loops stay seamless.
- Depth order by `zIndex` from the path's z on a flat parent with `perspective` (no
  `preserve-3d` sorting); only the poster card keeps `preserve-3d` for its two faces.
- New fields: snakes, cards per snake, path width, spacing, delay between cards. The deck tilt
  field is gone.
