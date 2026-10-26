# Embed and React SDK draw with gpu-core

The embed (`/e/<id>`) and `@feega/motion-react` showed motion through the
hyperframes HTML player (DOM/CSS, in an iframe for React). The canvas draws
the same docs with gpu-core, so the two could differ in text, filters and
blending. Now a plain video is drawn by gpu-core everywhere.

- `GpuFullLayer.svelte`'s loop became `mountPlayer` in
  `@feega/motion-core` (`gpu-full/play.ts`); the editor uses it, and so does
  `<feega-gpu-player>` (`gpu-full/player-element.ts`), a custom element with
  the hyperframes player's contract (`play/pause/seek`, `ready/timeupdate/
  ended` events), so `playerMain` drives it unchanged.
- `/motion-player.js`: that element bundled by esbuild through the existing
  `motion-bundles` plugin; `virtual:` modules are loaded by an esbuild plugin.
  About 2 MB minified: `display-list.ts` still reaches the HTML composer
  (three.js). Detaching it shrinks the bundle.
- `stageOf`: gpu-core unless the doc is interactive or an expression reads live
  input; those keep hyperframes. Stored legacy pages keep their own player.
- `/e/<id>/source.json` gives a host the doc, tokens and hosted assets.
  React fetches it, draws inline, and falls back to the iframe on 404.
  React 0.2.0: the server renders an empty stage instead of the iframe.
- gpu-core/gpu-text wasm resolve against `import.meta.url` and are served
  with CORS, so the module works from other sites.
- Kept: the downloadable interactive bundle and the canvas live page use
  hyperframes (offline file; live input).
