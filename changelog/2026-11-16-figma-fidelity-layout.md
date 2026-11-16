# Figma import reads what the doc already drew

The doc model had constraints, min/max sizes, mattes, paragraph spacing, caps,
joins, dash patterns and image crop windows; the importer never read them from
Figma. Both importers (clipboard and REST link) share the mapper, so one change
in `scene.ts` / `figma-doc.ts` serves both, and `rest-message.ts` rewrites the
REST field names into the clipboard ones.

What is read now:
- constraints of a child of a frame without auto layout (`horizontalConstraint`
  and `verticalConstraint` in the clipboard, `constraints` in REST);
- `minSize`/`maxSize` (clipboard), `minWidth`, `minHeight`, `maxHeight` (REST);
- mask layers: the layers above a mask, up to the next mask, get
  `matte` and `matteFrom` pointing at it (alpha, luminance; outline is drawn as
  alpha). The mask itself is hidden by the existing matte rule;
- `textAlignVertical`, `paragraphSpacing`, `paragraphIndent` (px in Figma, em in
  the doc), and gradient fills on a text run;
- `strokeCap`, `strokeJoin`, `miterLimit`, dash patterns longer than two values;
- image fills: a stretched fill with a crop transform becomes a crop window,
  a tiled fill keeps `scale` and `rotation`;
- `visible: false` keeps the layer, hidden. The doc already skips hidden clips
  in auto layout and lets an instance override `hidden`. Hidden top-level nodes
  and hidden children do not enlarge a paste.

Reported in the notice instead of dropped silently: per-side stroke weights,
inner shadow spread, stroke caps that are arrows, an outline mask without a
fill, a rotated image crop.

Left alone on purpose:
- the layer blur halving is right: the doc blur radius is a sigma
  (`effects/registry.ts`), and Figma's radius is twice the sigma;
- a child that hugs: an auto layout child already hugs through its own
  sizing; a shape or a frame without auto layout has nothing to hug.

Needs model work, not done here: per-side stroke weights on a path (`sides`
exists on a stroke but only a rectangle uses it), inner shadow spread (no
`spread` param on the inner shadow effect), an image crop that zooms out or
rotates (the crop window is inside the picture and axis-aligned), arrow caps
from a single Figma cap.

An instance with a mask inside no longer falls back to a plain group:
`instance-diff.ts` compares `matteFrom` through the clip pairs like `parent`.

Tests: `fidelity.test.ts`, one table row per case, each run through a real
clipboard encoding and through the REST rewrite.
