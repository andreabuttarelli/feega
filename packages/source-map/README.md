# feega-source-map

Dev-only plugins that tag every element with the `file:line:col` that wrote it, so [Feega](https://feega.app) can open, and edit, the source behind what you click in a live frame.

```bash
npx feega init     # adds the plugin to vite.config or next.config
```

Or by hand:

```ts
// vite.config.ts (React, Svelte, SvelteKit)
import { feegaSource } from 'feega-source-map/vite';
export default defineConfig({ plugins: [feegaSource(), /* ... */] });
```

```js
// next.config.mjs (webpack dev server)
import { withFeegaSource } from 'feega-source-map/next';
export default withFeegaSource({ /* your config */ });
```

Nothing is added to production builds. Docs: https://docs.feega.app/integrations/source-map/
