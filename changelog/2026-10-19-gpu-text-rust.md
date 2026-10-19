# Text in the Rust core: gpu-text

`packages/gpu-text` is the Rust side of gpu-full text, a crate of its own so `gpu-core` (owned by
another stream) is not touched:

- `Source`/`Face`: WOFF2 decoded with `wuff`, HarfRust shaping (optional ligatures off once text
  is tracked, as in the TS face), skrifa outlines and metrics at a variation location.
- `FaceBook`: `@font-face` rules → face, ported from `fonts.ts` (unicode range, nearest weight like
  the browser, synthetic oblique, wght/opsz then explicit axes).
- `lay_out`: Parley line breaking with tracking, line height, kept or collapsed spaces (collapsed
  before building: Parley's ranged builder ignores `WhiteSpaceCollapse`), no-wrap.
- `TextCore` (wasm32 only): the WASM boundary, flat `Float32Array`s.

`harfrust` and `skrifa` are pinned to the versions Parley 0.12 and Vello 0.11 already use. All
dependencies are permissive (MIT/Apache/BSD/Zlib/Unicode-3.0). `fonts.ts` and `painter.ts` are
unchanged; wiring the TS `Face` to `TextCore` waits for the boundary to be agreed with the
`gpu-core` owner. CI gets a `gpu-text` job (tests + wasm build).
