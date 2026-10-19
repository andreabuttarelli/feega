# The Rust core draws layers and groups

Before: `core-web.ts` turned top-level `layer` items into images and
flattened every `group` (`ungroup.ts`), handing the group's opacity,
filters and masks to each child. Custom components arrive as one group
with hundreds of children, so:

- a group filter (poster grain) ran once per child, each on a
  full-frame texture: GPU memory ran out and frames came out blank
  (saturn iso-blocks: SSIM 0.33 vs HTML);
- a group opacity faded every child on its own, so overlaps darkened;
- layers inside groups (rasterised text, three.js canvases) were never
  converted and never uploaded;
- core exports skipped every custom component and fell back to HTML.

Now:

- `display_list.rs` has `Item::Layer` (picture keyed by `source`, drawn
  at `size` through its matrix) and `Item::Group` (children plus one
  look). `layers.rs` prepares a group's children recursively and draws
  them into one layer when the group needs one (filters, masks, blur);
  otherwise one opacity/blend layer wraps them. WebGPU, WebGL2 and
  native share this code; native loads a layer's `source` as a file.
- `filters::reach` bounds a filtered item's texture: SVG filters to the
  default region (box + 10%), CSS blur/drop-shadow to their spread,
  colour functions to the box. Filters with their own region or drawing
  in frame space (turbulence, tile, image, lighting) keep the frame.
- `core-web.ts` sends groups as they are and uploads every layer and
  image picture, groups included. `ungroup.ts` is gone.
- `renderOnCore` takes the custom DOM reads, so exports with custom
  components stay on the core.

Parity vs HTML (6 frames, mean / worst SSIM):

| fixture | gpu-full | core WebGPU | core WebGL2 | core export |
|---|---|---|---|---|
| saturn-aec7935d | 0.9981 | 0.9974 (was 0.3338) | 0.9986 | 0.9974 (was HTML fallback) |
| iso-blocks template | 0.9982 | 0.9974 | 0.9986 | 0.9974 |
| saturn-39cd5543 | 0.9995 / 0.9971 | 0.9988 / 0.9926 (was 0.0511) | 0.8581 / 0.1486 (was a crash) | 0.9988 / 0.9926 |

Open: on WebGL2 a `multiply` layer inside a group wipes what is under
it in vello_hybrid (39cd5543 reaches 0.9708 with that blend forced to
normal).
