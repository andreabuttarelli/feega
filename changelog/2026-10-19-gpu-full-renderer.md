# Full GPU renderer, phase 1 (`?engine=gpu-full`)

The hybrid engine (`?engine=gpu`) needs the composed HTML page and a browser to raster what it
doesn't recognise, so it can't run natively. `gpu-full` reads the doc instead: `preparedDoc`
(extracted from `composeHtml`, no behaviour change) → `drawFrame` → display list → WebGL2
stencil-and-cover raster with MSAA and separable gaussian blur. No DOM, no browser raster.

Drawn: BrandBackground (solid), Shape (rect, ellipse, polygon, star, path; solid, linear, radial
fills; both fill rules), 2D transforms and keyframes, parents, opacity, blur. Everything else is
reported as unsupported with a reason, never drawn approximately. Preview only; export and
default stay on HTML.

Parity harness: `bench:gpu-parity --under=gpu-full` adds pixels-off share next to SSIM/PSNR;
`scripts/gpu-parity/kinds.ts` writes one doc per kind. Numbers and the target stack (Vello,
Parley, HarfRust, Taffy, wgpu) in ADR 0019.

Finding: the user's real fixtures are all `Custom` components; no library kind moves them.
