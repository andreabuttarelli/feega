import { execFileSync } from 'node:child_process';
import { access, cp, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const here = (path) => fileURLToPath(new URL(path, import.meta.url));
const CLI = here('../npx/dist/cli.cjs');

const exists = (path) => access(path).then(() => true, () => false);

if (!(await exists(CLI))) {
  execFileSync('npm', ['run', 'build'], { cwd: here('../npx'), stdio: 'inherit' });
}

const node = { bundle: true, platform: 'node', format: 'cjs', target: 'node20', external: ['electron'] };

await build({ ...node, entryPoints: [here('src/main/main.ts')], outfile: here('dist/main.cjs') });
await build({ ...node, entryPoints: [here('src/main/preload.ts')], outfile: here('dist/preload.cjs') });
await build({ bundle: true, platform: 'browser', format: 'iife', target: 'chrome130', entryPoints: [here('src/renderer/renderer.ts')], outfile: here('dist/renderer/renderer.js') });

await mkdir(here('dist/renderer'), { recursive: true });
await cp(here('src/renderer/index.html'), here('dist/renderer/index.html'));
await cp(here('src/renderer/style.css'), here('dist/renderer/style.css'));
