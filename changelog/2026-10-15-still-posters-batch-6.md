# Eight more still posters (batch 6)

## Why

Eight new references, one poster each, same `poster-kit.ts` pipeline as batches 2–5: one
`Custom` clip per poster, every text, shape and photo a `data-part` with its own colour and
position fields, grain as the poster's Noise effect, a card with the `poster` role so the Frame
templates picker lists it.

## What

- `builtin:poster-diagonal-pills`: diagonal lilac pills with gradient tails, words along them,
  a rotated title. Own: ring `marker`, `index` line.
- `builtin:poster-blue-trails`: blue dots with horizontal gradient trails on grainy black, title
  lines shifted by `titleShift`. Own: ring `marker`, vertical `index`.
- `builtin:poster-step-blobs`: grey grid, huge thin title (difference blend over the shapes) and
  number, rounded stepped shapes (`roundedPath` over a staircase polygon). Own: `marker` inside
  the box, `index`.
- `builtin:poster-metaball-listing`: event listing in a CSS-grid auto layout, pink metaballs
  (goo filter) with a halftone shadow (dot pattern masked by the same blobs), huge words.
- `builtin:poster-pixel-burst`: slanted pixel title, a pink starburst masking a photo slot
  (SVG clip path, multiply), stacked words, outlined button.
- `builtin:poster-acid-strokes`: calligraphic crescent strokes, spiky bursts and an oval, a
  title with a script word in its gap, vertical dates.
- `builtin:poster-glyph-specimen`: glyph crops in a ruled cell grid, a fluorescent goo blob
  chain, vertical title and dates, mono feature list.
- `builtin:poster-stencil-steps`: green/magenta stepped rectangles, stencil syllables (CSS mask
  cut), black label tags.

All copy is neutral English placeholder; no reference names, Cyrillic or Chinese text.

## Decisions

- **Kept the single-clip part model, not Shape clips + masks + auto-layout frames.** Template
  start lifts a still poster out of its precomp only when it has one clip (`liftSoleClip`,
  #560); a multi-clip poster would land inside a precomp and none of its layers would be
  selectable. Shapes are SVG paths with gradient fills inside the component, the starburst
  photo uses an SVG clip path, the listing uses CSS grid. Moving posters to real Shape/mask
  layers needs `liftSoleClip` to lift every clip first.
- `poster-kit.ts` gains `textPartProps`/`smallTextProps` (props per part) and `POSTER_TEXT`/
  `POSTER_SHAPES` (JS helpers: `textPart`, `roundedPath`, `gooFilter`, `dotPattern`). Shared
  small font/size keep each poster under the 40-prop cap.
- `cssFont` quotes font names with `'`: `fontOf` returns `"Name", …`, which inside
  `style="…"` closes the attribute and drops the font. Batches 2–5 still inline `fontOf` that
  way (e.g. `dark-tags`); not touched here.
- Previews: stills ship the `.jpg` only.

## Tests

`poster-batch-6.test.ts` runs each component in jsdom: it composes, draws parts that are
fields, keeps fonts inside the style attribute, every text part is editable in place, every
part has its own colour (or is a photo fill). The batch joins `posters.test.ts`.
`frame-templates.spec.ts` searches all eight and inserts one as a frame (real stack).
