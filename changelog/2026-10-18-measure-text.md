# measure_text and one-line hug text

Agents could not know where a text clip's ink ends, so nothing could be placed next to it.

- `measure_text {clip_id}` returns `{left, top, width, height}` px of the lines at rest and the
  wrapped lines. Advances come from the same fontsource file the outline code uses
  (`outlineUrl`), parsed with opentype.js on the server (`font-advance.ts`, cached per URL,
  kerning on). If the font cannot be read (uploads, network) it falls back to the auto-layout
  estimate (0.5 em per glyph, 0.62 for capitals) and says `approximate: true`. Ignores
  transform, keyframes, animators, Caption padding and Title safe-box clamping.
- Auto layout: a Text that hugs its width is laid out with `sizing: auto` (no wrapping), so a
  slight under-estimate no longer breaks "Get started" into two lines beside its icon. The hug
  width itself still uses the estimate: the layout is synchronous and shared with the browser.
