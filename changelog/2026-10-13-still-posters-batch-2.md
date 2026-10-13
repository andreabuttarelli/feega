# Five more still posters

**Before.** The still library had two posters (type grid, checker steps), each repeating the same
prop helpers and the same draw loop.

**Kit.** `poster-kit.ts` now carries the prop builders (`textProp`, `linesProp`, `numberProp`,
`colourProp`, `fontProp`, `prefixProp`) and `posterComponent`, which wraps a view with the shared
helpers (`fontOf`, `escaped`, `linesOf`, `box`) and the run loop (redraw on prop, size or font
change). A view only defines `scene` and `draw(p, width, height)`. The two existing posters were
left as they are.

**Templates**, one per reference, placeholder copy only:
- `builtin:poster-overlay-grid`: grey paper, monospace text blocks on a three-row grid with crop
  marks, two blocks of big yellow words behind, running off the edge.
- `builtin:poster-circle-event`: white, giant name, green circle, schedule column, date and a
  two-line title anchored to the foot with the last line in the accent.
- `builtin:poster-block-title`: worn off-white, title auto-fitted to the width, a violet block
  rising into the last line and stretching down to the names row; worn print as SVG specks and
  scratches (`wear`).
- `builtin:poster-boxed-type`: per-line grey title boxes, a dark box with one huge word, a light
  boxed statement, tags top and bottom; in tall formats the stack is centred in the spare height.
- `builtin:poster-square-words`: words placed from a `left baseline` list (one pair per line),
  `front` decides which go over the square; square height follows the frame height so the overlap
  holds in 9:16.

A prop named `name` breaks a Custom clip (it collides with the component name), so the circle
poster's name is `heading`. Prop titles are capped at 60 characters.

The shape test now accepts `radius: 50%` (perfect circles) and nothing else.
