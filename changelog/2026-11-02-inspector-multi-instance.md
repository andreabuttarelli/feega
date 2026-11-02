# Several layers and instances get X, Y, W, H; one name per layer

Props audit H12, H13, H14, M14.

- Multi-select had no box: `MultiInspector` only drew X/Y/W/H when a `boxes` prop was
  passed, and the canvas never passed it. It showed Offset X/Y, Scale and Anchor instead,
  transform values that read 0 / 100% whatever the layers look like. Now `layer-box.ts`
  reads each layer's box (`propBoxes` + `quadOf`): one value where they agree, Mixed where
  they differ. Typing X/Y moves each layer; W/H sets each layer's own size, and scales a
  layer that has no size of its own (an instance, an adjustment).
- Spacing is blank where the layers overlap: a negative gap read "-200 px" on two rects
  side by side.
- Constraint and style selects read words (`optionLabel`), not raw values.
- An instance (a Precomp with a main component) shows the same `BoxFields` in Layout, and
  its header says "Instance of <main>"; the Composition select is hidden for it (swap
  lives in the instance panel).
- `layerLabel` / `layerKind` in `element-name.ts` are the one name for a layer, used by
  Layers and by the Properties header. The header said "Shape" where Layers said "Box";
  a text layer is now named by its first line in both.

Discarded: editing the union box of the selection (the old behaviour when boxes were
passed) — Figma and the audit expect per-layer values with Mixed.
