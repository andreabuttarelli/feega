# URL import fidelity on the GPU canvas

The URL import fidelity harness only scored the HTML still export. The canvas draws frames with
the GPU core, so an import could score well and look different on the canvas.

## What changed

- `scripts/url-import/gpu-fidelity.ts` (`gpu-host.ts`, `gpu-world.ts`): puts every plan frame in
  a GPU core world the way `CoreFrames.svelte` does (groups, uses mapped into the node box,
  camera over a 1280 x 800 surface), screenshots each band of the canvas element and scores it
  with the same SSIM as the HTML harness (`fidelity-score.ts`, moved out of
  `url-fidelity.browser.test.ts`). Page assets are served locally, fetched with the page as
  referer.
- GPU text read `src:url(data:...;base64,...)` up to the semicolon: inline fonts were dropped
  (`fonts.ts` descriptor regex).
- `fontkitSource` decoded glyph 0 as TrueType on load and threw on CFF fonts (`OTTO`): every CFF
  font fell back to DM Sans.
- The GPU display list ignored `clipContent` on parents; it now adds the HTML render's crop (the
  intersection of clipping ancestors up to the nearest Precomp) as an intersect mask.
- Still frames rounded both sides to even pixels independently; a 1280 x 14535 page became
  1442 x 16384 and was drawn 9 px short, centred. The short side is rounded down and the long
  side derived from it (`draw-create.ts`). The HTML harness resized with `cover`, which hid this;
  both harnesses now stretch into the node box like the canvas use matrix.

## Discarded

- Reading the WebGPU canvas with `drawImage` after the frame: blank once presented. The harness
  screenshots the canvas element instead.

## Not yet

- Apple's font host answers 403 to a server fetch without a browser referer: `importFont`
  in-app likely fails for such pages (HTML and GPU both fall back).
- Webflow and Framer remaining gaps are capture-side (banner, carousel, scroll-driven tabs).
