# GPU canvas: textures on screen are never evicted

The GPU canvas keeps decoded images in a 256 MB LRU. Eviction destroyed
the least recently requested texture even when a visible card still drew
it; the next frame then failed and the whole canvas stayed blank (only DOM
labels and ports left) until a camera move culled the broken sprite.

- Each card holds its textures; the LRU skips held entries and releases
  them only once no card draws them.
- `gpu-canvas-painted.spec.ts`: on the heavy canvas copy, cold, after a
  window resize, warm, and at every zoom step out and back, every visible
  node must have non-background pixels and no frame may fail. The pixel
  check runs in light scheme: black posters on the dark canvas read as
  unpainted.
- A marquee or drag on the canvas no longer selects page text (WebKit
  selected the whole page): `html.canvas-gesture` turns off `user-select`
  for the duration of the gesture.

Not reproduced locally: the user's blank canvas. The eviction path is the
one that matches the symptom (whole GPU layer gone, DOM chrome left).
