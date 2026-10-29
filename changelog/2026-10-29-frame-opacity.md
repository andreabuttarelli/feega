# Frame opacity fades the whole frame, never to black

- Before: the Frame view's Opacity is the surface clip's `opacity` transform. It faded only
  the surface fill; layers stayed opaque. The surface also sets `background: transparent`,
  so the display list came out with `background: null`, and `onStage` on the canvas paints a
  frame's missing background black: at 0% the frame turned black wherever no layer covered it.
- Now (Figma layer opacity): `frameFadeAt` reads the surface opacity; `drawFrame` wraps every
  other item in one group at that opacity (the surface keeps its own, so each is faded once),
  and a surfaced frame's background is clear `[0,0,0,0]`, not `null`, so the black stage stays
  off. HTML: `#root{opacity}` and `unfaded` strips the surface's own opacity so it is not
  applied twice. Video export uses the same display list.
- Gap: the HTML root takes the opacity at frame 0; a keyframed frame opacity animates only
  on the GPU path. Codegen does not carry frame opacity yet.
