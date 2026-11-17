import { spawnSync } from 'node:child_process';
import { copyFileSync, mkdirSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { describe, expect, it } from 'vitest';

const stage = (files: string[]) => {
  const root = join(mkdtempSync(join(tmpdir(), 'feega-')), 'with space');
  for (const file of files) {
    mkdirSync(dirname(join(root, file)), { recursive: true });
    copyFileSync(file, join(root, file));
  }
  return root;
};

describe('entry scripts under a path with a space', () => {
  it('node-server runs instead of exiting silently', () => {
    const root = stage(['scripts/node-server.mjs']);
    const run = spawnSync(process.execPath, [join(root, 'scripts/node-server.mjs')], { encoding: 'utf8' });
    expect(run.status).not.toBe(0);
    expect(run.stderr).toContain('handler.js');
  });

  it('local runs instead of exiting silently', () => {
    const root = stage(['scripts/local.mjs', 'src/lib/local-ai-keys.js']);
    const run = spawnSync(process.execPath, [join(root, 'scripts/local.mjs')], { encoding: 'utf8', env: { ...process.env, PATH: '' } });
    expect(run.stdout).toContain('building the app once');
  });
});
