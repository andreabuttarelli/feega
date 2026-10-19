# Text laid out natively in gpu-core

A display list can now carry a `text` item instead of pre-flattened glyph paths. Native
`gpu-core` (the `Renderer` and `gpu-core-render`) shapes, lays out and outlines it in Rust with
`gpu-text`, then hands the resulting paths to the scene like any other.

- `painter.ts` is split: `planOf` (props, fills, easing, animator looks: everything that needs the
  app) and `inksOf` (layout and geometry: needs only fonts). `paintText` is `inksOf(planOf(env))`,
  so the TS output did not change.
- `drawFrame` emits `text` items plus the list's `faces` when the typeset carries `native` faces.
  On-path text still goes as paths. Web never sets `native`, so the WebGL/WebGPU rasters see no
  text items.
- `gpu-text` gains `set_lines` (a port of `layout.ts`, not Parley: parity with the TS pipeline is
  the point) and `contours` (flattening, stem darkening, line masks). `gpu-core` gains `text`
  (the `inksOf` port) and `stroke` (closed, butt, mitre bands). Both are native only: the wasm
  core does not grow.
- Parity: `native-parity.test.ts` writes `packages/gpu-core/tests/fixtures/text-parity.json`
  (file snapshot, so a TS change that moves text fails until the fixture is rewritten with `-u`);
  `tests/text.rs` expands the same lists natively and compares. Shaping is HarfRust vs fontkit,
  outlines skrifa vs fontkit: drift stays under 0.25 px, paints match exactly.
