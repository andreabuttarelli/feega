# Motion document and display list move to `packages/motion-core`

First step of "every SDK renders with gpu-core": the code that turns a
motion doc into a gpu-core display list must be shared by the app, the
embed, React and Flutter. It lived in `src/lib/motion`, which packages
cannot import.

- Moved the import closure of `motion/doc.ts` and
  `motion/gpu-full/display-list.ts` (254 modules, 110 of their tests,
  plus `canvas/composition`) to `@feega/motion-core`. Paths keep their
  shape: `$lib/motion/x` is now `@feega/motion-core/motion/x`.
- Pure move: every changed line outside `package.json`/lockfile is an
  import specifier. 28 tests that also read app modules stay in the app.
- The closure is wide because `display-list.ts` reaches the HTML composer
  (`hyperframes/compose`), which drags in three.js and the `virtual:`
  runtime bundles. Cutting that edge is the next step, before the Rust
  port (phase 2) replaces this TypeScript.
- `scripts/motion-libs.ts` and `motion-bundles.ts` import the package by
  relative path: Vite loads its config with Node, which does not
  transpile TypeScript enums from `node_modules`.
