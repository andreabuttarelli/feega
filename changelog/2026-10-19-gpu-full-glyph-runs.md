# gpu-full can hand text to the core as glyph runs

With `TextOutput.Glyphs` (native export: `npm run export:native -- … --text=glyphs`) the text
painter emits `{ kind: 'glyphs', font, coords, size, glyphs: [[id, x, y]…], paint, … }` items that
gpu-core outlines itself with gpu-text (#939), instead of flattened outlines. The browser keeps
outlines (`TextOutput.Outlines` is the default everywhere else). Faces now carry the file and
coordinates they came from (`Face.key`, stamped once per face by `faceBook`), which is the run's
`font`; native export writes each used file to disk and passes it as `--font url=path`.

A unit still goes out as outlines when the core could not reproduce it from ids alone: a stroke,
a synthetic oblique, a clipped fill (diamond/angular quadrants), a squashed radial, an image fill,
or a Title line still rising behind its mask. Unit transforms ride in the item matrix.

Native export of `kinds.ts fonts`, glyph runs vs outlines: SSIM 0.9999–1.0000, ≤0.11% pixels off.
Upload font URLs containing `=` would break `--font key=path` (gpu-core splits on the first `=`).
