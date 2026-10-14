# Properties panel by selection kind

The right-hand Properties panel was a list of sections derived from each schema field's `group`:
a text colour sat in "Style" next to the poster's grain, tracking showed as `↔ -0.035`, transform
values as glyphs (`ΔX`, `⤢`, `KX`), colours as five brand swatches plus a native picker, and
Layout was folded by default. A Title showed two Opacity fields (box and transform). Several
selected clips showed only the composition.

Now:

- `properties-view.ts` holds one table, `FAMILY_SECTIONS`, from clip family to the sections it
  may show; `sectionsFor(family, view, mode)` filters it by view (a poster part keeps only
  styling sections) and mode (Design drops Animation). `PropertiesView.Multiple` is new.
- `inspector-sections.ts` files each field by key (`KEY_SECTION`, `TEXT_KEYS`), then by control
  (colour → Fill, font → Text), then by group. `Typed` keeps `align`/`size` in Text only on
  components with a font. `shadowed()` hides a box opacity/scale/rotation already shown by the
  transform, unless it was changed. Order: Content, Layout, Layer, Fill, Stroke, Path, Effects,
  Text, Timing, Animation, 3D, Parent & mask — the slots the Fill stack and Layer/Effects
  components from the design-system work drop into.
- `fieldLook` gives English short labels and units (`Spacing em`, `Line ×`, `Offset X`) — display
  only; `units.ts` and every op the agent uses are unchanged.
- `ColorField` (swatch + hex + popover with the native picker, brand tokens, recent colours in
  `localStorage` via `colour-field.ts`), `SegmentedField` (align, fit, case), `FamilyIcon`,
  `MultiInspector` (X, Y, rotation, scale, opacity, blend; `mixed.ts` returns `MIXED` when values
  differ, edits go through `editIn`/`setBlendMode` per clip).
- `.props` spans both grid rows and the timeline only the stage column: on the canvas at laptop
  widths the panel stopped 210px short (the timeline row) and clipped its content without a
  scrollbar.

Not done: colour opacity (the model stores no alpha), hiding internal custom-component fields
like `varPrefix`, the design-system primitives from #539 (not on dev yet). The seeded e2e
`properties-panel.spec.ts` reproduced the 210px gap before the fix; it was not re-run after,
because seeded runs against production were stopped.
