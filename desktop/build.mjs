import { execFileSync } from 'node:child_process';
import { access, cp, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const here = (path) => fileURLToPath(new URL(path, import.meta.url));
const CLI = here('../npx/dist/cli.cjs');

const exists = (path) => access(path).then(() => true, () => false);

if (process.env.FEEGA_REUSE_CLI !== '1' || !(await exists(CLI))) {
  execFileSync('npm', ['run', 'build'], { cwd: here('../npx'), stdio: 'inherit', shell: process.platform === 'win32' });
}

const node = { bundle: true, platform: 'node', format: 'cjs', target: 'node20', external: ['electron', 'electron-updater'], define: { __FEEGA_VERSION__: JSON.stringify('desktop') } };

await build({ ...node, entryPoints: [here('src/main/main.ts')], outfile: here('dist/main.cjs') });
await build({ ...node, entryPoints: [here('src/main/preload.ts')], outfile: here('dist/preload.cjs') });
await build({ bundle: true, platform: 'browser', format: 'iife', target: 'chrome130', entryPoints: [here('src/renderer/renderer.ts')], outfile: here('dist/renderer/renderer.js') });

await mkdir(here('dist/renderer'), { recursive: true });
const STATIC = ['index.html', 'style.css', 'tokens.css', 'fonts.css', 'pixel-band.png', 'fonts'];

for (const name of STATIC) {
  await cp(here(`src/renderer/${name}`), here(`dist/renderer/${name}`), { recursive: true });
}
