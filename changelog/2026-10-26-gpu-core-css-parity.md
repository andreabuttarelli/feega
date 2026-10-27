# gpu-core draws the CSS motion templates use

SaaS monitor drew a black frame on the canvas (#1340): the DOM read
(`gpu-full/dom/read.ts`) refused radial gradients, `color(srgb …)` (what a
computed `color-mix()` becomes), the `url()` grain and the `matrix3d` screen,
and one refusal drops the whole frame.

Now read:

- `radial-gradient` (ellipse via a y-squash in the path matrix, extents,
  `at` positions), gradients on bordered boxes, `none` layers in the list.
- `url()` backgrounds and `<img>`: the probe rasterises them into a bitmap
  (`node.layer`), drawn as a layer.
- 3D: `matrix3d`, parent `perspective`, `preserve-3d` chains. Path points are
  projected through the exact homography (`warped`); bitmaps and paints take the
  least-squares affine of the box corners. Rejected: a projective item kind in
  gpu-core — vello has no projective transform, and paths cover almost all
  pixels.
- `mask-image` linear edge fades (one linear ramp mask per fade), rounded and
  `%`-cornered (elliptical) clips and boxes, inset box shadows, svg `<line>`,
  `backdrop-filter: blur()`, filters and blend modes on multi-child elements
  (drawn as one group).

Still refused: `conic-gradient`, url/luminance masks, mask-image with
intermediate alpha, non-blur backdrop filters, `Composition` and
`Image` component clips (not DOM).

Measured with `bench:gpu-parity --under=gpu-core` over all 127 builtin
templates; table in the PR.

Found while verifying in the built app: `gpuScript` serialized `gpuMain`
with `toString()` while it closed over module names; minified, the page threw
`J1 is not defined` and no three.js template drew in the canvas DOM read. The
constants now arrive as parameters (`gpu.test.ts` minifies and runs it).
