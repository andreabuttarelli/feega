# Action steps in effects nodes

F2 (flora-vs-feega). Flows had only stylistic effects; no practical post steps.

- Three more entries in the `EFFECTS` registry (`canvas/effects/index.ts`): `colour-grade`
  (brightness, contrast, temperature), `chroma-key` (colour distance to alpha), `fit-aspect`
  (crop or pad to 1:1, 4:5, 3:4, 16:9, 9:16). They run in the editor, in `apply_effects` and on
  video frames, and show up in `list_effects`, through the shared registry.
- Video encode scales to even dimensions so a padded or cropped frame stays valid for yuv420p.
- Not done: format convert (the node outputs PNG / MP4 only).
