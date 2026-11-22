import { cp, readFile, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { build as esbuild, context } from 'esbuild';
import { build as vite } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';

const here = (path) => fileURLToPath(new URL(path, import.meta.url));
const SOURCE_MAP = here('../packages/source-map/src/');
const LAUNCHER = here('dist/launcher/');

const BRIDGE_FILES = JSON.parse(await readFile(here('src/host/bridge-files.json'), 'utf8'));

const WATCH = process.argv.includes('--watch');

await rm(here('dist'), { recursive: true, force: true });

const HOST = {
  entryPoints: [here('src/host/extension.ts')],
  outfile: here('dist/extension.cjs'),
  bundle: true,
  platform: 'node',
  format: 'cjs',
  target: 'node20',
  external: ['vscode']
};

if (WATCH) {
  await (await context(HOST)).watch();
} else {
  await esbuild(HOST);
}

await esbuild({
  entryPoints: [`${SOURCE_MAP}vite.ts`],
  outfile: `${LAUNCHER}vite.js`,
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node20',
  external: ['vite', 'svelte', 'svelte/*', '@vue/compiler-sfc', '@astrojs/compiler/sync', './bridge.js']
});
await Promise.all(BRIDGE_FILES.map((f) => cp(`${SOURCE_MAP}${f}`, `${LAUNCHER}${f}`)));
await cp(here('launcher/launch.mjs'), `${LAUNCHER}launch.mjs`);
await cp(here('launcher/next-preload.cjs'), `${LAUNCHER}next-preload.cjs`);
await cp(here('launcher/astro.mjs'), `${LAUNCHER}astro.mjs`);
await cp(here('launcher/nuxt-layer'), `${LAUNCHER}nuxt-layer`, { recursive: true });
await esbuild({
  entryPoints: [`${SOURCE_MAP}next-loader.ts`],
  outfile: `${LAUNCHER}next-loader.cjs`,
  bundle: true,
  platform: 'node',
  format: 'cjs',
  target: 'node20',
  external: ['svelte', 'svelte/*', '@vue/compiler-sfc', '@astrojs/compiler/sync'],
  define: { 'import.meta.url': 'importMetaUrl' },
  banner: { js: "const importMetaUrl = require('node:url').pathToFileURL(__filename).href;" },
  footer: { js: 'module.exports = module.exports.default;' }
});

await vite({
  configFile: false,
  root: here('src/webview'),
  plugins: [svelte({ configFile: false })],
  build: {
    watch: WATCH ? {} : null,
    outDir: here('dist/webview'),
    emptyOutDir: true,
    cssCodeSplit: false,
    rollupOptions: {
      input: here('src/webview/main.ts'),
      output: { entryFileNames: 'panel.js', assetFileNames: 'panel.[ext]', format: 'iife' }
    }
  }
});
