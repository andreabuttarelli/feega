import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { shimmedArgs } from './folder-source';
import { SHIM_CONFIG } from './folder-shims';

const dirs: string[] = [];

async function folder(files: Record<string, string>): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'feega-folder-'));
  dirs.push(root);
  for (const [path, content] of Object.entries(files)) {
    await mkdir(join(root, path, '..'), { recursive: true });
    await writeFile(join(root, path), content);
  }
  return root;
}

afterEach(async () => {
  await Promise.all(dirs.splice(0).map((d) => rm(d, { recursive: true, force: true })));
});

describe('the folder dev server', () => {
  it('starts a Vite folder that imports next/image on the shimmed config', async () => {
    const root = await folder({ 'package.json': JSON.stringify({ devDependencies: { vite: '^7.0.0' } }), 'src/header.tsx': 'import Image from "next/image";' });
    expect(await shimmedArgs(root)).toEqual(['--config', join(root, SHIM_CONFIG)]);
    expect(await readFile(join(root, SHIM_CONFIG), 'utf8')).toContain("'next/image'");
  });

  it('starts a folder with nothing to shim as it is', async () => {
    const root = await folder({ 'package.json': JSON.stringify({ devDependencies: { vite: '^7.0.0' } }), 'src/button.tsx': 'export const Button = () => null;' });
    expect(await shimmedArgs(root)).toEqual([]);
  });
});
