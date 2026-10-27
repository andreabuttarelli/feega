# gpu-core draws compositions, empty media and clips turned in depth

Composition clips (every `composition-*` template, `launch-ui-explode`) and Image, Video and Logo clips without a picture were refused by `drawFrame`, so 31 builtin templates showed black on the core canvas. They now go through the DOM reader like `Custom`: the HTML engine's placeholder card, the brand name a Logo sets as text, and the composition `<canvas>` (read as a layer, so filled compositions match pixel for pixel). Templates mark those roots with the `cc-` id the reader already looked for; the Logo text gets a box-sized flex root so its place in the box is read, not assumed.

Clips with `rotateX`/`rotateY`/`z`/`skew` were refused as `space-3d`. `gpu-full/depth.ts` builds the clip's 4x4 (parent perspective wrapper, own transform in the engine's CSS order); paths go through the exact projection (`warp.ts`, moved out of the DOM reader), pictures and native text through the least-squares affine of the box. A clip behind the eye stays refused.

A frame with any refusal used to be kept off the core canvas entirely (`drawsWhole`); with no poster it stayed black. It is now drawn with what the core supports (`drawsAny`), and `logGaps` logs every element left out.

Also: a Custom component's own `easing` prop ("expo" in scroll-story) was sampled as the clip move ease and threw; a clip without a move skips the sampling.

Bench (`bench:gpu-parity --under=gpu-core --frames=2`, 127 builtins): fully drawn 86 → 118, no template worse.
