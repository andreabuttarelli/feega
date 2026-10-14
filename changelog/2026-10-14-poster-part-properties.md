# A selected poster part now shows all its fields

Clicking a poster part — from the canvas or from Layers — set `selectedPart`, but
`MotionInspector`'s `focus` prop filtered the field list to `f.key === focus`: one key, the
part's own text field (`parsePart(part).field`). Colour, font and size for that part never
appeared, even though the editing code path and the selection itself were wired correctly. The
report calling this "selecting a part doesn't work" was really this: selection worked, Properties
showed almost nothing once it did.

Which fields belong to a part is decided by `partFieldKeys(doc, clip, field)` in
`inspector.ts`, in one place:

- **its own fields by name**: `<part>` plus `<part>Color|Colour|TextColor|BgColor|BorderColor|TagColor|Font|Size|Weight|Height|X|Y|Leading`
  (the last suffixes came with the batch-5 posters, which name every part's fields this way)
  (`titleSize`, `overlayX`, `numberColour`…);
- **a table row where a poster names them otherwise**: `PART_FIELDS_BY_POSTER`, e.g.
  `CircleEventPoster.heading → nameSize`, `OverlayGridPoster.overlayLow → lowX, lowY`. A test in
  `posters.test.ts` fails if a row names a part or field the poster does not have;
- **every Style/Layout field no part claims** (`ink`, `font`, `paper`…): poster-wide, shown with
  every part.

So selecting the title shows the title's size but not the caption's. The first cut (this
branch, before review) showed every Style/Layout field for every part; on posters with per-part
sizes that listed the sizes of every other part too.

`MotionInspector` opens the sections that hold a focused field: they were collapsed, so the
colour and size were in the DOM but out of sight. `focus` went from `string | null` to
`readonly string[] | null`.

Not done: per-part visibility. No poster has a per-part show/hide prop today; hiding a part is
emptying its text.
