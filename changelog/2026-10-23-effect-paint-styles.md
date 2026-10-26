# Effect styles and gradient/image styles (EF-06, PT-08)

Shared styles (#1128) held text and a solid colour only.

- `StyleKind.Effect` holds an effect stack (shadows, blurs, any effect but LUTs), `StyleKind.Paint`
  holds a fill stack (gradients, images). Schemas in `styles-model.ts` reuse `effectSchema` and
  `fillsSchema`.
- A clip had one `styleRef`. Effects are not props and coexist with a text or colour style, so
  `StyleSlot` splits the link in two: `styleRef` (text, colour, paint) and `effectStyleRef`
  (effect). `SLOT_OF` in `styles.ts` is the one table that says which kind uses which slot;
  `REFUSAL` says which components take which kind; `APPLY` and `LOOK_OF` say how a kind is written
  to a clip and read back from one.
- Edit: `defineStyle` restyles every clip linked in either slot, and `syncedDoc` pushes it to every
  frame of the canvas. Effect keyframes whose effect disappears with the new stack are dropped.
- Create from selection: `saveAsStyle` with `Paint` or `Effect`; Properties gets "Save fill style",
  "Save effect style", an effect-style picker and "Update <name> from this clip" (the edit path: change
  the clip, push its look into the style).
- Canvas styles list: swatch for paint styles, labels by content (`styleLabel`). `fill/swatch.ts`
  now builds the swatch CSS FillStack used to inline.
- MCP: `named_style` accepts the new kinds, a `save` action and a `slot` on `detach`. Clip reads
  carry `effectStyleRef`. CLI skill updated.

Image fills in a paint style keep the asset id; they resolve wherever the asset is visible (the
same canvas). Effect styles carry no LUT: the LUT payload would sit inside the style record.
