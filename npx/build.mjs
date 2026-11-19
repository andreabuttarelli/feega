import { execFileSync } from 'node:child_process';
import { cp, readFile, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const here = (path) => fileURLToPath(new URL(path, import.meta.url));
const INSPECT_DIST = here('../inspect/dist/');
const { version } = JSON.parse(await readFile(here('package.json'), 'utf8'));

execFileSync(process.execPath, [here('../inspect/build.mjs')], { stdio: 'inherit' });

await rm(here('dist'), { recursive: true, force: true });
await build({
  entryPoints: [here('src/cli.ts')],
  outfile: here('dist/cli.cjs'),
  bundle: true,
  platform: 'node',
  format: 'cjs',
  target: 'node20',
  external: ['bufferutil', 'utf-8-validate'],
  define: { FEEGA_VERSION: JSON.stringify(version) },
  banner: { js: '#!/usr/bin/env node' }
});
await cp(`${INSPECT_DIST}webview`, here('dist/webview'), { recursive: true });
await cp(`${INSPECT_DIST}launcher`, here('dist/launcher'), { recursive: true });
