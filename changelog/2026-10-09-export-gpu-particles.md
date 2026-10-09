# Particles drawn by the GPU compositor in export

Step 6 of the GPU compositing plan. The particle field was a 2D canvas the size of the frame:
the export sent it to the compositor as an `ImageBitmap`, and WebKit read it back from the GPU
on every frame when the host uploaded it.

- Each frame the particle runtime leaves on its canvas a function (`PARTICLE_STATE`) that packs
  the frame's particles (`particleQuads`, 9 floats each). The capture walk turns it into a
  `particles` paint; the compositor draws it as instanced quads in the shared WebGL2 context,
  clipped to the canvas, in list order — same placement, size, turn, colour and opacity math as
  `drawParticles`.
- The soft glow is not uploaded: the shader rebuilds the 2D glow tile (power-of-two size between
  `MIN_GLOW_PX` and `MAX_GLOW_PX`, shared with `drawParticles`), samples it bilinearly on the
  texel grid and weights the quad edges by pixel area. A first analytic disc (no tile) was
  visibly sharper on 1–2 px stars: 45 dB → 51 dB once the tile was emulated.
- Sprites keep the canvas path (they need their image). The live preview keeps the 2D canvas:
  parity is close, not exact, and the preview never reads the canvas back.

Parity, gpu-before vs gpu-after (only particles differ): asteroids Chromium 50.4–50.7 dB,
WebKit 50.9–51.4 dB. Speed, asteroids WebKit 1 lane, 3 interleaved A/B runs: 635 → 494
ms/frame; Chromium 4 lanes and the glass fixture unchanged (within noise).
