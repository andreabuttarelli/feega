import { cp, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { build as esbuild } from 'esbuild';
import { build as vite } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';

const here = (path) => fileURLToPath(new URL(path, import.meta.url));
const SOURCE_MAP = here('../packages/source-map/src/');
const LAUNCHER = here('dist/launcher/');

await rm(here('dist'), { recursive: true, force: true });

await esbuild({
  entryPoints: [here('src/host/extension.ts')],
  outfile: here('dist/extension.cjs'),
  bundle: true,
  platform: 'node',
  format: 'cjs',
  target: 'node20',
  external: ['vscode']
});

await esbuild({
  entryPoints: [`${SOURCE_MAP}vite.ts`],
  outfile: `${LAUNCHER}vite.js`,
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node20',
  external: ['vite', 'svelte', 'svelte/*', './bridge.js']
});
await Promise.all(['bridge.js', 'runtime.js'].map((f) => cp(`${SOURCE_MAP}${f}`, `${LAUNCHER}${f}`)));
await cp(here('launcher/launch.mjs'), `${LAUNCHER}launch.mjs`);

await vite({
  configFile: false,
  root: here('src/webview'),
  plugins: [svelte({ configFile: false })],
  build: {
    outDir: here('dist/webview'),
    emptyOutDir: true,
    cssCodeSplit: false,
    rollupOptions: {
      input: here('src/webview/main.ts'),
      output: { entryFileNames: 'panel.js', assetFileNames: 'panel.[ext]', format: 'iife' }
    }
  }
});
