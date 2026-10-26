import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const repoRoot = fileURLToPath(new URL('../../', import.meta.url));
const config = 'web-docs/scripts/vitest.gen.config.ts';

const run = spawnSync('npx', ['vitest', 'run', '--config', config], { cwd: repoRoot, stdio: 'inherit' });

process.exit(run.status ?? 1);
