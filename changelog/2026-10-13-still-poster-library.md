# A still poster library: type grid and checker steps

**Before.** Every library entry was a video. Stills existed (`doc.still`) but nothing in the
library started as one.

**Kind.** No new field: a template whose doc carries `still` is a still template.
`catalogue()` reports `mode: docMode(doc)`, `matching()` filters by it, and the component library
gets a Videos / Stills tab row; a still card has a picture preview and no clip
(`Preview.video` is null, chosen by the `PREVIEW_VIDEO` table). `starterDoc` copies the template's
`still`, so starting from a poster (editor, API `from-template`, MCP, CLI) opens a still.

**Templates.** `poster-kit.ts` builds a poster doc: one Custom clip (`customTemplateDoc`), 4:5
size, still at 0, and the Noise effect as editable grain. Both are DOM + CSS components, laid out
in fractions of the frame so 9:16 and the A poster work without a layout per format.
- `builtin:poster-type-grid`: huge grotesk line stack auto-fitted to width and height; `[photo]`
  places a picture slot (from `media`, else an abstract generated pattern), `->` an arrow; four
  footer columns. Tall frames spread the lines past 25% spare height.
- `builtin:poster-checker-steps`: a staircase checker sized in squares (`columns`, `cellAspect`,
  `shift`, `top`), one title word per step, worn print as SVG specks and scratches (`wear`), a
  text block under a bar top right.

Data URIs carrying `url(#filter)` fail the CSS lint, so the textures are set from JS as CSS
custom properties.

**Not done.** Template cards (`role: poster`) live on the unmerged `template-cards` branch:
there is no `card.ts` on dev to add them to.
