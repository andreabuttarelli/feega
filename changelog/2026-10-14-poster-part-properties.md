# A selected poster part now shows all its fields

Clicking a poster part — from the canvas or from Layers — set `selectedPart`, but
`MotionInspector`'s `focus` prop filtered the field list to `f.key === focus`: one key, the
part's own text field (`parsePart(part).field`). Colour, font and size for that part never
appeared, even though the editing code path and the selection itself were wired correctly. The
report calling this "selecting a part doesn't work" was really this: selection worked, Properties
showed almost nothing once it did.

Posters are built from `CustomComponent.propsSchema`, and every `PropSpec` already carries a
`group: 'Content' | 'Style' | 'Layout' | 'Motion' | 'Camera'` (see `poster-kit.ts`'s `colourProp`,
`fontProp`, `numberProp`). In every poster template, `Style`/`Layout` fields (ink, paper, font,
fontWeight, fill, leading, margin, per-block sizes…) are poster-wide controls, not per-part; only
`Content` fields are one-per-part (title, byline, caption…). So "the fields of a part" has a
general answer that needs no per-poster table: the part's own field, plus every `Style`/`Layout`
field of the component. `partFieldKeys(doc, clip, field)` in `inspector.ts` does exactly that,
reusing `clipFieldGroups` instead of introducing a second schema.

`focus` on `MotionInspector` changed from a single `string | null` to `readonly string[] | null`;
the field filter changed from `f.key === focus` to `focus.includes(f.key)`. Nothing else in the
selection path needed touching — `LayersPanel`'s `video.selectPart` and `MotionEditorShell`'s
`layersSource.publishVideo` already set `selectedPart` correctly.

Discarded: a naming-convention guess (`titleColor`, `titleFont`, `titleX`…). Checked three
templates (`block-title-poster`, `type-grid-poster`, plus `scatter-title`'s doc); none name
colour/font per part — they're shared poster-wide, which a convention guess would have missed or
guessed wrong silently. The `group` field already encodes the real design intent and needed no
rewriting.

Not done in this change, called out so it isn't mistaken for finished: the Layers tree not
listing a closed frame's children, hover highlighting between Layers and canvas, and the Layers
vs canvas dual-selection bug (select a row, then click a different canvas node — both stay
selected) are each a separate, real issue that deserves its own failing test and its own PR
rather than a drive-by fix bundled into this one.
