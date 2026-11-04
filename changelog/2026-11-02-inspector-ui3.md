# Inspector primitives restyled after a UI3-style reference

The right-bar inspector read as a form: 28px fields with `sm` radius, a blue wash behind
opacity, 18px fill swatches next to a boxed opacity input, a chevron before the section's `+`.
The restyle happens in the shared primitives, so every section and the Stack properties
another branch adds get it without per-section copies.

- `InspectorSection`: 13px semibold title, actions then the chevron at the row's end; the
  chevron is a span and `.section-head::after` covers the whole row, so there is still one
  toggle button (the `actions.test.ts` rule against bare icon buttons holds). `data-open`
  mutes a closed title.
- `NumberField`: 32px `md` chips, label inside, sans values (the BDO Grotesk tabular figures
  read as mono). `FieldFill.Range` now draws a slider track in the same chip instead of the
  wash; `valueAtShare` maps a point on the track to a value on the step. Roundness gets the
  range look and the short label `Radius`.
- `PositionSection`: segmented groups with 1px seams, chips at 32px.
- Appearance (`layerBody`): opacity chip + slider + visibility eye (`setClipFlags hidden`),
  radius chip + slider + per-corner, then blend as a full-width outlined select with a
  droplet. Blend's text label is gone; the select has `aria-label="Blend mode"`.
- Fill and stroke rows share `paint-row.ts`: 32px swatch, hex in medium, a muted line with the
  inline opacity (or width) and the type (or position). Same test ids; `fill-meta` and
  `stroke-meta` are new.
- Text: font picker full width (label kept for screen readers), align groups and the advanced
  toggle on one row.
- `FramePresetSection` W/H as chips.

Discarded: icons as field labels (X/Y/W/H stay letters; opacity and radius keep words),
a custom select arrow (native arrows read fine in both themes).
