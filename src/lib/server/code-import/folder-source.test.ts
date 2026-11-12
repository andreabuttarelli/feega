import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { devServerOf } from './folder-source';
import { PlanRefusal } from './run-plan';

const roots: string[] = [];

async function folder(files: Record<string, object>): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'feega-folder-'));
  roots.push(root);
  for (const [path, body] of Object.entries(files)) {
    await mkdir(join(root, path, '..'), { recursive: true });
    await writeFile(join(root, path), JSON.stringify(body));
  }
  return root;
}

afterEach(async () => {
  await Promise.all(roots.splice(0).map((r) => rm(r, { recursive: true, force: true })));
});

describe('devServerOf', () => {
  it('a local monorepo with several apps asks which one before spawning anything', async () => {
    const root = await folder({
      'package.json': { workspaces: ['apps/*'], scripts: { dev: 'turbo run dev' } },
      'apps/web/package.json': { scripts: { dev: 'next dev' }, dependencies: { next: '15' } },
      'apps/docs/package.json': { scripts: { dev: 'astro dev' }, dependencies: { astro: '5' } },
      'node_modules/next/package.json': { scripts: { dev: 'x' }, dependencies: { next: '1' } }
    });

    expect(await devServerOf(root, null)).toMatchObject({ ok: false, refusal: PlanRefusal.ChooseApp, apps: ['apps/docs', 'apps/web'] });
  });
});
