import type { Post } from './post';

const PR = 'https://github.com/andreabuttarelli/feega/pull/';

const pr = (n: number) => `<a href="${PR}${n}">#${n}</a>`;

export const CANVAS_FAST: Post = {
  title: 'How the Feega canvas got fast',
  description: 'Tiles, offscreen frames, cheaper blur, analytic shadows and a wasm half the size: what made the Feega canvas fast, with the numbers from each change.',
  heading: 'How the canvas got fast',
  lede:
    'The Feega canvas draws imported websites, Figma files and motion frames with a Rust engine compiled to WebAssembly on WebGPU. A few weeks ago zooming a page of landing pages ran at 30 fps. These are the changes that fixed it, in the order they landed, with the numbers from each pull request. Every one is open source.',
  published: '2026-11-12',
  sections: [
    {
      heading: 'The budget: 90 fps',
      html: `<p>We measure every gesture (pan, zoom, fit, drag) on two fixtures: a board of landing pages and a heavy real canvas. The number that counts is the share of frames over 11.1 ms, the budget for 90 fps. Averages hide stutter; that share does not. Each change runs interleaved against the base build (base, fix, fix, base) so machine load hits both sides equally.</p>`
    },
    {
      heading: 'Tiles',
      html: `<p>Redrawing every frame from scratch on each zoom step was the first wall. ${pr(1942)} turned on a tiled renderer by default: content is rastered into tiles once and gestures draw the tiles. On the landings board at 1x CPU, zoom went from 30 fps with a p95 of 84 to 118 ms to 58 fps at 18.5 ms. Fit went from 31 to 60 fps. The cost was real too: an edit took 10 to 15 ms longer, and a warm open drew about 0.35 s later. We shipped it and listed those gaps.</p>`
    },
    {
      heading: 'Offscreen frames',
      html: `<p>After load, panning showed empty frames for seconds: textures were kept only for what was on screen, and builds were queued only for visible frames. ${pr(1955)} keeps the nearest offscreen frames resident within the texture budget and builds every frame, on screen first. Eight seconds after opening, panning across the board found missing content in 16 of 24 steps before, and in 2 of 24 after.</p>`
    },
    {
      heading: 'The eviction stall',
      html: `<p>Baking tiles for the whole canvas meant pinning them so eviction would not throw them away. Checking whether a tile was pinned had become a walk over every pinned tile, on every eviction. ${pr(1975)} made the check constant time. On the heavy canvas, body paints during pan, zoom and fit dropped from 368 to between 154 and 214, and mask passes from 308 to 0.</p>`
    },
    {
      heading: 'The tile pyramid',
      html: `<p>${pr(2002)} replaced the ad hoc bakes with one pyramid of absolute levels: 1/16, 1/8, 1/4, 1/2 and 1x of the pixel ratio. The coarsest covers the whole canvas, they bake in idle time from coarse to sharp, and a gesture below the pixel ratio draws the nearest level without rastering a blurry tile. Landings zoom p95 fell from 8.5 to 9.3 ms to 3.9 ms, with 0.4% of frames over budget instead of 2.5%.</p><p>The first version regressed pan, and the reason was instructive: raster batches during movement went from 3,004 to 16,741, because a level could get a share smaller than the screen and because coarse levels stopped at the canvas edge, so panning past it found "missing" tiles every frame. Both were fixed before merge.</p>`
    },
    {
      heading: 'Batched loading and parallel builds',
      html: `<p>The engine itself loaded in two serial round trips: the JavaScript glue, then the wasm, both revalidated on every open. ${pr(1997)} fetches and compiles the wasm in parallel with <code>WebAssembly.compileStreaming</code> and serves both under a content hash with immutable caching. Median time from asking for the wasm to having it went from 261 ms to 54 ms; first drawn content from 536 ms to 481 ms.</p>`
    },
    {
      heading: 'A wasm half the size',
      html: `<p>The shipped engine was 4.4 MB raw and 685 KB over brotli, 1.4 MB of it a name section nobody needed.</p><ul><li>${pr(1996)}: fat LTO, one codegen unit, abort on panic, strip. 579 KB brotli. We kept <code>opt-level = "s"</code>: <code>"z"</code> was 28 KB smaller and about 15% slower on pan and drag. <code>wasm-opt</code> shrank raw bytes 9% but grew compressed bytes 5 to 6%, so it stayed out.</li><li>${pr(2008)}: text reaches the engine as paths, yet the unused glyph path kept a TrueType hinting VM linked. Removing it: 450 KB, pixel-identical on zoomed text.</li><li>${pr(2007)}: SIMD, a few KB smaller and about 7,600 vector ops in place of scalar code.</li><li>${pr(2029)}: the WebGL fallback moved to its own wasm, fetched only by browsers without WebGPU. WebGPU users now download 357 KB brotli.</li></ul><p>From 685 KB to 357 KB, about half. Load time barely moved on localhost; the saving is for slow networks.</p>`
    },
    {
      heading: 'The cheap blur',
      html: `<p>Imported websites are full of shadows and blurs, and each one was a full-resolution Gaussian pass. Three changes made them cheap:</p><ul><li>Shadow LOD, ${pr(2009)}: a shadow whose on-screen extent is under 2 device pixels is not drawn at all. At fit, most are.</li><li>Bilinear taps, ${pr(2010)}: pairs of Gaussian taps merge into one hardware-filtered fetch at their weighted offset, about half the fetches. Bilinear is exact only on premultiplied pixels, so the blur now premultiplies first.</li><li>Decimated blur, ${pr(2011)}: a wide blur halves the image until the remaining sigma is at most 2, blurs there with at most 13 taps, and scales back up once. The variance the resampling adds is subtracted from the kernel.</li></ul><p>On a 1024 px layer a 35 px drop shadow went from 2.23 ms to 0.64 ms and a 140 px one from 2.17 ms to 0.67 ms. Against the old kernel the worst case differs by 4 levels out of 255 (SSIM 0.995).</p>`
    },
    {
      heading: 'Analytic shadows',
      html: `<p>A shadow under a rectangle or rounded rectangle has a closed form: no blur pass needed. ${pr(2017)} recognises those (box-shadow, inset, a drop-shadow on an opaque rounded rect) and draws them analytically. Forty-eight cards with a 12 px shadow cost 25.2 ms natively with the filter path, 17.2 ms analytic, against 16.1 ms with no shadow: about 9 ms of shadow became 1 ms. The pixel diff also showed the old path was about 5 levels too light. Honest limit: on our fixtures only 17 of 227 filtered items qualified; most shadows sit on groups or glyphs and still take the filter path.</p>`
    },
    {
      heading: 'Filters that do nothing',
      html: `<p>On the heavy canvas, 101 of 174 filtered paths were <code>blur(0px)</code>. ${pr(2036)} drops filters that leave pixels unchanged (zero blur, transparent shadows, identity brightness and the like) from one table, with a GPU test that output is byte-identical with and without them.</p>`
    },
    {
      heading: 'Gradient ramps',
      html: `<p>Profiling a drag showed 2.0 s of 4.5 s on the main thread spent writing buffers and textures. Of 21.8 MB uploaded per pass, 12.1 MB was the gradient ramp texture, re-uploaded whole on every render though it rarely changed. ${pr(2021)} keeps it beside the image atlas and uploads only when it changes: 0 bytes per pass after the first.</p>`
    },
    {
      heading: 'The bench lied, then the product did',
      html: `<p>Heavy-canvas zoom swung between 4% and 18% of frames over budget on the same build. The bench fired wheel events as fast as Playwright could send them, so wheels per frame followed machine load. ${pr(2039)} paces it at one wheel per frame; three sessions on the same build then agreed within one point.</p><p>The noisy bench had been pointing at a real problem: trackpads deliver several wheels per frame, and each one recomputed the camera, culling and overlay. ${pr(2041)} queues them and applies them once per animation frame. Unpaced zoom on the heavy canvas went from 4 to 6% of frames over budget to 0.2 to 1.2%.</p>`
    },
    {
      heading: 'What is left',
      html: `<p>Drag on the heavy canvas still puts about 2.5% of frames over 11.1 ms, and fit on the landings board varies between runs. Phones get smaller tile budgets and have not had the same attention. The benches and fixtures are in the repository, so the next change gets measured the same way.</p>`
    }
  ]
};
