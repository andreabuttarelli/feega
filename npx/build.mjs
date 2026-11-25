import { execFileSync } from 'node:child_process';
import { cp, readFile, rm, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const here = (path) => fileURLToPath(new URL(path, import.meta.url));
const INSPECT_DIST = here('../inspect/dist/');
const readJson = async (path) => JSON.parse(await readFile(here(path), 'utf8'));
const { version } = await readJson('../inspect/package.json');
const { private: _, scripts: __, ...manifest } = await readJson('package.json');

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
await cp(`${INSPECT_DIST}library.json`, here('dist/library.json'));
await writeFile(here('dist/package.json'), `${JSON.stringify({ ...manifest, version, bin: { feega: 'cli.cjs' }, files: undefined }, null, 2)}\n`);
await cp(here('README.md'), here('dist/README.md'));
