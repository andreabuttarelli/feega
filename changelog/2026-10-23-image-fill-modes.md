# Image fill modes: fill, fit, crop, tile

An image fill had `cover | contain | fill | tile` and a focus/scale pair. Figma's four modes are
Fill, Fit, Crop and Tile, with tile scale and rotation.

- `ImageFit.Crop` and two optional fields on the image fill: `crop` (`x y w h`, 0..1 of the
  picture; absent = whole picture, read with `cropOf`) and `rotation` (tile only, degrees).
  Optional on purpose: stored docs and the poster fixture stay as they are.
- `IMAGE_CONTROLS` (model.ts) says which Properties fields each mode shows; `IMAGE_FIT_LABEL`
  names them as Figma does (cover = Fill, contain = Fit, fill = Stretch).
- HTML (`fillLayersHtml`): crop is the picture stretched to `100/w %` and offset by `-x/w %`;
  a rotated tile is a covering square spun around the centre, tile size in `cqw` so it matches the
  unrotated one.
- GPU (`raster.ts`): crop is `cropRect`; tile is `tileCells` (cells a quarter of the box wide per
  unit of scale, placed by the focus offset, covering the rotated box, capped at `MAX_TILES`)
  drawn one by one under the item matrix turned around the box centre. Tile used to fall back to
  cover on the GPU.
- Not done: text filled with a cropped or tiled picture (stays a gap, as tile already was);
  SVG export names crop and tile as skipped framings.
