# Export lanes capped by WebGL contexts

Chromium keeps 16 live WebGL contexts per page and silently evicts the oldest. Export ran up to 4
capture lanes (≥8 cores); asteroids (5 Shape3D) needed 4×5 + compositor = 21, so one lane lost its
three.js contexts and every 4th frame had no 3D (19.7 dB vs WebKit, 117 of 465 frames).

- `composeHtml` writes the per-lane WebGL count into `<meta name="feega-webgl">`: 3D layers,
  3D compositions, liquid blobs, custom components using three/twgl/PIXI.
- `webgl-budget.ts` holds the budget (16), the page reserve (2: compositor + editor) and
  `lanesWithin`; `MotionPreview.render` and the bench apply it.
- Asteroids now exports on 2 lanes: 669 vs 591 ms/frame, no dips (min 28.1 dB).
- Discarded: counting from the doc (duplicates compose's traversal and comp flattening);
  probing contexts at runtime (needs a lane mounted first).

`bench:export` was broken by #313: the bench server now serves `/motion-libs` and compose gets its
origin. The `virtual:motion-libs` config gap is fixed in #368.
