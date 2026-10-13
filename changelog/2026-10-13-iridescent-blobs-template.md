# Iridescent blobs template

First generative built-in template: no media, everything drawn by one fragment shader on the
shared `three.renderer` (one WebGL context, freed in `onDestroy`).

- Model (`model.ts`, pure JS, tested): 10 seeded metaballs swaying on integer harmonics of
  `2π·speed·t/length`, so the last frame is the first. Bubbles are anchored to host blobs
  (fixed pool of 64, density slices it, so editing density keeps the rest in place). Title is
  its own beat (`titleAt`/`titleSeconds`) with a dim on the mass; empty title = no beat.
- Shader: 2D field Σ(r²/d²)², noise-warped with noise translated on a circle (seamless loop);
  height = dome + lumps → normals from finite differences; pearl colour from normal-driven hue
  between body/cyan/sheen; fresnel + edge band in the rim colour; inner glow near bubble
  clusters; black sphere bubbles with contact shadow; hashed glitter twinkling on integer
  multiples of the loop phase.
- Landscape swaps axes, so the mass always runs along the long side.
- Key fields: title, body, rim, glow, bubbles. Var prefix `blobs`.
- Discarded: raymarched 3D SDF (too slow in the software GL the local render uses: 2D field
  already costs ~6 s/frame at 1080×1920 there).
- Found: inserting a 30 fps template into a 60 fps doc keeps the nested composition at the
  template's frame count (360), so the video goes blank after 6 s. The local render script
  patches it; the library is untouched here.
