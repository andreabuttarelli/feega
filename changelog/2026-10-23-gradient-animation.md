# Animatable gradients (PT-10, SK-08)

Gradient stops were static: only the legacy `fill`/`fill2` colours of a shape keyframed.

- New keyframe source `Source.Fill`. Keys name a fill by index: `fill.<i>.stop.<n>.color|pos`,
  `fill.<i>.angle|cx|cy|radius`, `fill.<i>.colour` (solid). `src/lib/motion/fill/keys.ts`
  parses keys, lists the lanes a stack offers (`fillProps`, joined into `withParams` for Shape
  clips) and writes sampled values over the stored stack (`applyFillKeys`).
- GPU: `propsAt` in `display-list.ts` samples the lanes into `props.fills` before the shape is
  painted. Linear and radial stay on the native path; angular and diamond fall back as before.
- Export: `lookAt` in `hyperframes/shapes.ts` applies the same lanes, so the existing per-frame
  shape bake rewrites the SVG gradient (stops, end points, centre, radius) frame by frame.
- Properties: a keyframe diamond beside stop colour, position, angle, centre and radius. While a
  lane exists, editing the shown value writes a keyframe at the playhead (`splitFillEdit`).
  Timeline: the lanes appear through `keyLanes` like effect params.
- MCP: `set_keyframes` takes the same keys; description updated.

Keys are positional: removing a fill or a stop leaves keys for a slot that no longer exists and
the edit is refused until the lane is removed. Text and stroke gradients are not keyable yet.
