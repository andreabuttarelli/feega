# Smart animate between frames

Figma-parity gap T3 (row 21): a link could only slide or dissolve the whole frame.

- `TransitionKind.SmartAnimate` (`smart_animate`) in the prototype transition union, with easing and
  `durationMs` like dissolve. No direction.
- `packages/motion-core/src/motion/smart-animate/`: `smartAnimate(source, target, progress, ease)` is
  a pure function over two docs. `layersOf` keys each clip by its name when that name is unique in
  its frame, otherwise by id; a pair matches on equal key and equal component. Matched layers
  interpolate x, y, width, height, rotation, opacity, fill and radius with `easeCurve`; unmatched
  layers fade (leaving out, entering in). Non-hex fills switch at the midpoint.
- Editor preview: `SmartAnimatePreview.svelte` under the link in `PrototypeSection.svelte`, play
  and scrub. `prototypeLink.docs` (filled by `GpuFlow.svelte`) gives it the target doc.
  `previewBox` turns an animated layer into pixels.
- Agent: no new tool; `add_interaction` takes the new transition kind, description updated.
  Tool-surface snapshot regenerated (one line).

Not done: playing the transition (T2 player does not exist on this branch); the player should call
`smartAnimate` per frame. Strokes, text content and effects are not interpolated. Discarded: matching
by position or by similarity, which silently pairs the wrong layers; Figma matches by name too.
