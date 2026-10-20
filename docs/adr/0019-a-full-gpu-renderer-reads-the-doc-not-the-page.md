# A full GPU renderer reads the motion doc, not the composed page

Context: the hybrid GPU engine (`src/lib/motion/gpu/`, `?engine=gpu`) still starts from the HTML
page: it parses `composeHtml` output, runs the timeline in a DOM, and composites on the GPU only
what it recognises (fills, SVG shapes rasterised by the browser, text laid out by the browser,
images). Everything else is a browser raster of the layer. That cannot run outside a browser,
so it cannot ship in the Tauri apps on wgpu/Dawn, and its fidelity is bounded by the DOM.

Decision: a second renderer, `?engine=gpu-full`, takes **the doc** and never builds a page:

```
MotionDoc ─ preparedDoc (same normalisation composeHtml uses: comps flattened, paths,
   │         expressions, physics baked)
   ▼
drawFrame(prepared, frame) ─► DisplayList   pure, deterministic, no DOM
   │   items: paths (flattened contours, fill rule, paint, opacity, affine, blur)
   │   unsupported: [{clip, component, reason}]   never drawn wrong, always named
   ▼
raster backend ─► pixels       today: WebGL2 stencil-and-cover + MSAA + separable blur
```

1. **The display list is the contract.** Everything above it is doc semantics; everything below
   is pixels. Each backend (TS/WebGL2 now, the Rust core later) consumes the same list, so the
   parity harness and the unsupported inventory carry over unchanged.
2. **What can't be drawn is named, not approximated.** `CLIP_LIMITS` (one table) and each
   painter return an `Unsupported` reason; the preview exposes the count
   (`data-unsupported` on `gpu-full-canvas`), the harness prints the list.
3. **HTML stays the default** until the harness reports parity on the user's real videos.
   Export keeps using HTML for now; `gpu-full` is preview-only.
4. **Parity harness** is `npm run bench:gpu-parity -- --doc=<doc> --under=gpu-full`: HTML engine
   vs gpu-full on the same frames, SSIM, PSNR and share of pixels off by more than 8/255, plus
   side-by-side mp4. `scripts/gpu-parity/kinds.ts <dir>` writes one doc per supported kind.

## Inventory (2026-10-19)

Real fixtures (`~/Documents/feega-videos/fixtures/saturn-*.json`, 4 docs): 4 clips, all of them
outside the library model — 3 `Custom` (two posters that build absolutely-positioned DOM +
inline SVG polygons + text via JS, one Three.js scene on its own WebGL canvas), 1 `Precomp`
wrapping one of them; 2 `noise` effects. The hybrid engine draws all 3 painted layers as HTML;
gpu-full draws 0. **No real video reaches parity by adding library kinds**: the user writes
custom components.

Library components, as today's hybrid engine classifies them with default props:

| Component | hybrid engine | gpu-full |
|---|---|---|
| BrandBackground | GPU fill | drawn (solid pattern) |
| Shape | browser-rasterised SVG | drawn: rect/ellipse/polygon/star/path, solid/linear/radial fills, both fill rules |
| Title, Text, Kicker, Caption | browser-laid text (GPU) | unsupported |
| Image, Logo, Video | GPU texture when an asset resolves | unsupported |
| ProductCard, SocialMockup, CanvasMock, Composition, Particles, ShaderEffect | HTML | unsupported |
| Model3D, Shape3D, Text3D, Logo3D, Device3D | HTML (Three canvas) | unsupported |
| LiquidGlass, LiquidBlob | HTML backdrop group | unsupported |
| Custom | HTML | drawn within the declared DOM subset; canvases as texture layers; text and the rest named (`dom/read.ts`) |

Clip features: transforms 2D, keyframes on transform/prop/param, parent chains, opacity, blur
(transform + gaussian effect) are drawn. Not yet: 18 of 19 effects, masks/mattes, the 8
transitions, 15 blend modes, tracking text animators, shaders, 3D space/camera, `move`, strokes, shape
modifiers with filters, angular/diamond/image fills, Line and Vector shapes, dots/grid/gradient
background patterns.

## Parity (Chromium, Metal, 1920×1080, 4 frames each)

| Kind | mean SSIM | worst | pixels off |
|---|---|---|---|
| background | 1.0000 | 1.0000 | 0.00% |
| shapes (6 geometries, evenodd) | 0.9989 | 0.9989 | 0.13% |
| gradients (linear, radial) | 0.9983 | 0.9983 | 0.09% |
| transforms (rotate/scale/x keyframes) | 0.9999 | 0.9997 | ≤0.05% |
| opacity | 0.9998 | 0.9997 | ≤0.06% |
| blur (keyframed 0→24 px) | 0.9995 | 0.9991 | 0.03% |

Residue is edge anti-aliasing (8× MSAA vs Skia's analytic coverage) and gradient interpolation.

## Stack (target, permissive only)

| Need | Choice | Licence | Why / against |
|---|---|---|---|
| 2D vector raster | Vello (compute, WebGPU + native wgpu) with `vello_hybrid` sparse strips for WebGL2 | Apache-2.0/MIT | Same scene API on both; hybrid's WebGL backend is the fallback. Hybrid is still pre-1.0, so the TS WebGL2 backend stays until it is proven. Against Skia/CanvasKit (BSD): ~7 MB wasm, C++ toolchain in the Tauri build. |
| Shaping | HarfRust (HarfBuzz port) + skrifa | MIT / Apache-2.0 | HarfBuzz-grade shaping, pure Rust, WASM-friendly, variable fonts via skrifa. |
| Text layout | Parley (line breaking, bidi, font fallback via fontique) | Apache-2.0/MIT | Same family as Vello; matches what the HTML engine does for fit-to-box once we measure with the same font files. |
| Box layout | Taffy (flex, grid, block) | MIT | Needed for auto-layout, ProductCard-style templates and the custom-component subset. Yoga is flex-only. |
| Effects | own WGSL passes (blur, shadow, colour matrix, blend, mask) | ours | Our effects are a closed list of 19; a generic filter engine buys nothing. |
| Composition | wgpu | Apache-2.0/MIT | Same code on WebGPU and Metal/Vulkan/D3D in Tauri. |

Text in Rust lives in `packages/gpu-text`, a crate of its own beside `gpu-core`: `Source`/`Face`
(HarfRust shaping, skrifa outlines and metrics, WOFF2 through `wuff`), `FaceBook` (the
`@font-face` matching of `fonts.ts`) and `lay_out` (Parley). Versions are pinned to the
`read-fonts`/`skrifa` that Vello already pulls, so one font parse serves both. Its WASM boundary
(`TextCore`: `add_font`, `covers`, `metrics`, `shape`, `outline`, `lay_out`, flat `Float32Array`s)
backs the TS `Face`; `gpu-core`'s boundary is unchanged: text still reaches it as contours in the
display list. When `gpu-core` wants to shape on its own it depends on `gpu-text` as an rlib.

Discarded: Blitz and Servo (Stylo is MPL-2.0, and they solve arbitrary HTML, which we don't
need); Ultralight (proprietary); keeping a browser in the loop for text (defeats native).

Custom components need their own answer: they emit DOM. Plan: a **declared subset** — absolute
boxes, transforms, solid/gradient backgrounds, borders/radii, inline SVG paths/polygons, text
spans — parsed from the component's output into display-list items; anything outside the subset
stays named-unsupported. WebGL custom components (Three.js) composite their own canvas on the
web; natively they need a JS+WebGL runtime and stay out of scope.

Built (2026-10-19): the component runs in a sandboxed opaque-origin iframe; a probe posts the
untransformed tree back per frame, `readTree` converts it (subset and gaps listed in
`changelog/2026-10-19-gpu-full-custom.md`). The Three.js fixture reaches SSIM 1.0000; the two
posters (0.85 / 0.80) miss only their text and two clip-path photo groups.

Ports of third-party code, when they happen, are recorded in `THIRD_PARTY_NOTICES.md`. None yet.
