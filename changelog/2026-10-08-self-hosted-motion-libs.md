# Motion libraries served from our origin, inlined in the interactive export

**Before.** Every composed page loaded the HyperFrames runtime, html-to-image and the
component libraries (three.js, Lottie, d3, p5, PixiJS + unsafe-eval, matter.js, LittleJS ESM,
KAPLAY, opentype) from `cdn.jsdelivr.net`. Editor preview, server frames, farm renders and the
`feega-interactive.html` export all depended on a third-party CDN; the export did not open
offline.

**Now.**
- `src/lib/motion/libs/catalog.ts` is the one table: package, pinned version, file, licence.
  `scripts/motion-libs.ts` (Vite plugin) writes `static/motion-libs/<name>@<version>/` from
  `node_modules` on every dev/build/test start: copies, plus two esbuild IIFEs (three.js as
  `__feegaThree`, LittleJS as `__feegaLittleJS`), self-contained esbuild ESM files for the
  three.js modules the built-in 3D clips import (`esm/three.module.js`, `esm/addons/...`, with
  `three` external) and opentype, and each package's licence file. A version mismatch fails the build.
  Pins: aliased `motion-three@npm:three@0.181.2`; exact devDependencies for the rest.
- Script tags carry SRI (`virtual:motion-libs`, sha384 computed at build) and
  `crossorigin="anonymous"`; `vercel.json` serves `/motion-libs/*` immutable with
  `Access-Control-Allow-Origin: *` (opaque-origin preview iframes need CORS); dev adds the
  same header.
- `ComposeInput.origin` picks the origin: `location.origin` in the browser, `PUBLIC_APP_URL`
  on the server (`libs-origin.ts`: server frames, farm job, embeds), the request origin in the
  preview route. CSP `script-src` lists only our origin; jsdelivr is gone from it.
- The farm sandbox may reach our host. jsdelivr stays in its allow list for HDRI files and
  3D-text font outlines (assets, not libraries).
- `interactiveBundle` composes once, inlines the player, the runtime and exactly the libraries
  whose `<script src>` appears, then composes again with them inline. A licence notice
  follows the doctype; p5 (LGPL-2.1) is included unmodified.
- LittleJS and custom three.js now boot as classic scripts, not module scripts.

**Size of the export** (bytes added when a component uses it): runtime 482 K + player 103 K
(always), p5 1058 K, three.js 716 K, PixiJS 456 K + 3 K, LittleJS 396 K, d3 280 K, KAPLAY
189 K, Lottie 168 K, matter.js 83 K. The live demo (p5 + LittleJS) went from 85 KB to 2.2 MB
and runs with the network blocked.

**Built-in 3D and mattes in the export.** The import map now lists exact modules
(`Module` in the catalog: three, five addons, opentype only for 3D text). The export inlines
each one as a `data:text/javascript;base64` entry and adds `data:` to `script-src`; a matte
inlines html-to-image as a classic script, and the capture/matte runtimes skip the load when
the global is already there.

**A failed library fetch fails the export.** Before, a 404 page from our origin was inlined
as if it were the library. Now a rejected fetch or an HTML answer throws
`<lib>@<version> could not be loaded: …`.

**Hosted embeds published before this change.** `/e/<id>` rewrites the stored page on read:
jsdelivr URLs of the runtime, html-to-image, three.js (module, addons prefix, base) and
opentype become `<request origin>/motion-libs/...`, and the player loads from our origin with
SRI. Pages uploaded from the editor carry the inlined download bundle: on read their inlined
scripts (recognised by the licence banner) and `data:` modules go back to
`/motion-libs/...` tags, and `script-src` gains `<origin>/motion-libs/`, so a hosted embed
caches libraries across embeds and `hostAssets` (#358) never sees code. Old embeds that imported LittleJS as an ES module from jsdelivr are not rewritten (we
host only its IIFE); republishing fixes them.

**Not covered.** The HyperFrames player keeps a jsdelivr fallback URL for the runtime; it is
used only when a page lacks the runtime, which ours never do.
