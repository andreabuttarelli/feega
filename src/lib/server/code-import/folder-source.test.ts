import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { withDevServer, folderLibrary, folderNames, shimmedArgs } from './folder-source';
import { SHIM_CONFIG } from './folder-shims';
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

describe('withDevServer', () => {
  it('a local monorepo with several apps asks which one before spawning anything', async () => {
    const root = await folder({
      'package.json': { workspaces: ['apps/*'], scripts: { dev: 'turbo run dev' } },
      'apps/web/package.json': { scripts: { dev: 'next dev' }, dependencies: { next: '15' } },
      'apps/docs/package.json': { scripts: { dev: 'astro dev' }, dependencies: { astro: '5' } },
      'node_modules/next/package.json': { scripts: { dev: 'x' }, dependencies: { next: '1' } }
    });

    expect(await withDevServer(root, null, async () => null)).toMatchObject({ ok: false, refusal: PlanRefusal.ChooseApp, apps: ['apps/docs', 'apps/web'] });
  });
});

describe('the folder dev server', () => {
  it('starts a Vite folder that imports next/image on the shimmed config', async () => {
    const root = await folder({ 'package.json': { devDependencies: { vite: '^7.0.0' } } });
    await writeFile(join(root, 'header.tsx'), 'import Image from "next/image";');
    expect(await shimmedArgs(root)).toEqual(['--config', join(root, SHIM_CONFIG)]);
    expect(await readFile(join(root, SHIM_CONFIG), 'utf8')).toContain("'next/image'");
  });

  it('starts a folder with nothing to shim as it is', async () => {
    const root = await folder({ 'package.json': { devDependencies: { vite: '^7.0.0' } } });
    await writeFile(join(root, 'button.tsx'), 'export const Button = () => null;');
    expect(await shimmedArgs(root)).toEqual([]);
  });
});

describe('folderNames', () => {
  it('un componente React scritto in .js entra nei nomi come uno in .jsx', async () => {
    const root = await folder({ 'package.json': {} });
    await mkdir(join(root, 'src'), { recursive: true });
    await writeFile(join(root, 'src/Hero.js'), 'export function Hero() { return <h1>Hi</h1>; }');
    await writeFile(join(root, 'src/Card.jsx'), 'export const Card = () => <div />;');

    expect(await folderNames(root)).toEqual(['Card', 'Hero']);
  });
});

describe('folderLibrary', () => {
  it('legge i componenti della cartella senza eseguirli, con i loro assi', async () => {
    const root = await folder({ 'package.json': {} });
    await mkdir(join(root, 'src/lib/components'), { recursive: true });
    await writeFile(join(root, 'src/lib/components/Badge.svelte'), "<script lang=\"ts\">let { variant = 'default' }: { variant?: 'default' | 'tag' } = $props();</script><span />");
    await writeFile(join(root, 'src/routes/page.svelte'), '<h1>Home</h1>').catch(() => undefined);

    const library = await folderLibrary(root);

    expect(library.components.map((c) => [c.name, c.file, c.axes.variant?.values])).toEqual([['Badge', 'src/lib/components/Badge.svelte', ['default', 'tag']]]);
  });
});
