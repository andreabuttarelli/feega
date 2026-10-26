# Drop web-push

`web-push` and `@types/web-push` had no import anywhere in src, scripts, packages or tests.

Checked and kept, though knip reports them unused: `shaders`, `pixi.js`, `@pixi/unsafe-eval`,
`p5`, `kaplay`, `littlejsengine`, `lottie-web`, `motion-three` (hosted by
`src/lib/motion/libs/catalog.ts` through `scripts/motion-libs.ts`), `hyperframes` (provides
`@hyperframes/*` imported by the player and the farm), `@resvg/resvg-js` (dynamic import by name
in site-analysis), `ffmpeg-static` (binary resolved by path), `@codemirror/view` (peer of the
codemirror packages in use).

Public changelog skipped: invisible.
