# Poster shapes are shapes, and take a colour

**Before.** A poster part's kind came only from its prop schema: a `linesProp` (string
textarea) made every part a text Line. SVG blocks (`<polygon>`, `<path>`, `<rect>`,
`<circle>`) and empty painted boxes were listed as TEXT rows, offered their coordinate line as
text, and a fill override wrote `color`, which paints nothing on a polygon or a box. "Poster
white shapes": changing a block's colour did nothing.

**Now.** The kind comes from the markup, derived once into `part-usage.json` (`shapes`:
field → `fill` | `background`) by `markupPaint` in `src/lib/motion/part-shapes.ts`, the single
table: geometry tags paint with `fill`, an empty leaf box with `background`; text, media
(images, gradients, clip paths, filters) and hit areas (`fill="transparent"`) are not shapes.
A field is a shape only when every instance is (diagonal-pills `pills` mixes text: not a shape).
`PartKind.Shape`: Layers icon `shapes`, label "Shape N", no inline text edit, own fields only.
`part-styles.ts` writes the override on the real paint property per kind. A shape prefers a
`<field>BgColor` key over `<field>Color` (month-grid `label` is the highlight box).

Shape fields now classified: iso-blocks blocks, white-shapes shapes, photo-grid accentCells,
vertical-type blackCells/accentCells, haze-grid haze, stacked-plus plus/quarter/rect,
barcode-table barcode, pixel-caps blackBlocks, month-grid label, blue-trails dots, step-blobs
grid/blobs, metaball-listing blobs, pixel-burst burst, acid-strokes strokes/bursts,
glyph-specimen rules/chain, stencil-steps rects.

Tests: `part-kinds.test.ts` (every builtin part vs its markup; every shape override reaches
its paint), `poster-shapes-recolour.spec.ts` (pixels change for every visible shape of every
builtin), `poster-white-shapes.spec.ts` @real (editor, tile, reload, Layers row).

Discarded: a selector-only fix painting every geometry under any part — it floods multi-colour
SVGs like the barcode.
