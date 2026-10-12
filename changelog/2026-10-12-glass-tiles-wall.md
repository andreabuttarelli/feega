# Glass tiles wall template

A curved wall of glossy glass tiles (picture or video, title, caption) on a
sphere section; the camera pans across it in expo in-out moves with a slow
tilt breath, and the loop closes exactly.

- CSS 3D only: one perspective container, tiles placed on the sphere. No
  WebGL: the bevel is layered gradients and a brightened rim copy of the media.
- Each DOM tile keeps its media for the whole loop: slots wrap on a period
  that is a multiple of the columns crossed per loop, so nothing swaps `src`.
- Rounded corners are allowed here: the tile is user content.
