# RenderComp templates as motion templates

The 50 free (MIT, (c) 2026 Trimora Inc.) RenderComp Remotion templates are ported to builtin templates
`builtin:rendercomp-<id>`, beside the snapcn ports and reusing their kit and serialiser
(`snapcn/model.ts` gained an optional `extend` so the six pixel-art templates share `rendercomp/pixel.ts`).
Remotion here only uses `interpolate` and `Easing` (no `spring`), both already in the kit; `easing.test.ts` pins them.

Decisions: array props (chart rows, messages, colour lists, scenes) become one delimited string prop; hex-alpha
suffixes become `S.withAlpha`; the pixel templates draw on a low-res canvas scaled with `image-rendering: pixelated`
(thousands of per-frame DOM rects were too heavy); default brand text is feega. Props named like PixiJS APIs
(`p.ticker`) and `.toString(16)` trip the custom-code contract checker, so they are avoided.
Nothing was skipped: the source needs only `remotion` and `react`.

Parity was checked by reading each draw against the source and comparing to the upstream README previews, not by
running upstream code. Catalogue date 2026-11-11 puts these first.
