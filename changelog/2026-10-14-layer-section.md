# Layer section: opacity + blend, flip, corner smoothing, clip content

**Before.** Opacity sat in a grid with blur, blend on its own row; no flip, no corner smoothing,
no clip content. Booleans were bare checkboxes; auto layout sizing said Hug; padding and corner
radii always showed every side.

**Now.**
- Layer row (`layer-look`): blend select + opacity slider + opacity number (same transform key,
  same `animate`/`stored` path as before).
- Flip: `motion/layer-props.ts`, `AXIS` table (horizontal → `scaleX`, vertical → `scaleY`);
  `flipPatch` negates the base scale through `setTransform`. No new model field.
- Corner smoothing: Shape prop `smoothing` 0..1 (default 0, rect only via `GEOMETRY_OF`).
  `rectOutline(radii, size, smoothing)`; at 0 it is the old code path, byte for byte. Above 0 the
  corner starts `r·(1+s)` along each edge and its handles move to `r·(1-κ)·(1-s)`: a squircle-like
  blend that is continuous with the circular arc.
- Clip content: clip flag `clipContent` (optional, no migration), set through `setClipFlags`.
  Compose crops each child layer with `clip-path: inset()` to the intersection of the resting
  boxes of its ancestors that clip. Shown in Properties only for a layer with children.
- Yes / No: `YES_NO`/`answerOf` in `motion/segments.ts`; every `Control.Toggle`, motion blur,
  clip content and auto-layout Absolute use `SegmentedField`.
- Auto layout: Hug reads Fit (value unchanged), padding is one field while all sides are equal,
  "Per side" splits it. Corners: "Per corner" splits the radius, "One radius" joins it.
- Agents: `set_visibility` takes `clip_content`, `get_motion_doc` shows `clipContent`;
  `add_shape` names `smoothing`; `set_transform` says negative scale flips.

**Limits.** The crop follows the parent's box at rest: a parent that moves by keyframes leaves
the crop where it was. Opacity on text "picture layers" is in the next PR.
