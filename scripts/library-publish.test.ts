import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
// @ts-expect-error plain module
import { main, packLibrary, uploadTarget } from './library-publish.mjs';

let items: string;

function item(id: string, manifest: Record<string, unknown>, files: Record<string, string>) {
  const dir = join(items, id);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'manifest.json'), JSON.stringify({ id, name: id, description: 'd', category: 'section', tags: ['t'], dependencies: [], ...manifest }));
  for (const [path, content] of Object.entries(files)) {
    mkdirSync(join(dir, path, '..'), { recursive: true });
    writeFileSync(join(dir, path), content);
  }
}

beforeEach(() => {
  items = mkdtempSync(join(tmpdir(), 'library-items-'));
  item('card', { tier: 'free', frameworks: ['svelte', 'react'] }, { 'svelte/Card.svelte': '<div/>', 'react/Card.tsx': 'tsx', 'react/Card.css': '.c{}' });
  item('hero', { tier: 'pro', preview: 'https://example.test/hero', frameworks: ['svelte'] }, { 'svelte/Hero.svelte': '<h1/>' });
});

afterEach(() => rmSync(items, { recursive: true, force: true }));

describe('packLibrary', () => {
  it('builds the index with tier and previewUrl and no file content', () => {
    const { index } = packLibrary(items);

    expect(index).toEqual([
      { id: 'card', name: 'card', category: 'section', tags: ['t'], frameworks: ['svelte', 'react'], tier: 'free', previewUrl: 'https://docs.feega.app/library/card' },
      { id: 'hero', name: 'hero', category: 'section', tags: ['t'], frameworks: ['svelte'], tier: 'pro', previewUrl: 'https://example.test/hero' }
    ]);
  });

  it('packs every file of a framework under items/<id>/<framework>.json', () => {
    const { files } = packLibrary(items);

    expect(JSON.parse(files.get('items/card/react.json'))).toEqual({
      files: [
        { path: 'Card.css', content: '.c{}' },
        { path: 'Card.tsx', content: 'tsx' }
      ]
    });
    expect([...files.keys()].sort()).toEqual(['index.json', 'items/card/react.json', 'items/card/svelte.json', 'items/hero/svelte.json']);
  });

  it('refuses a manifest with an unknown tier', () => {
    item('bad', { tier: 'gold', frameworks: ['svelte'] }, { 'svelte/Bad.svelte': 'x' });

    expect(() => packLibrary(items)).toThrow(/tier/);
  });

  it('refuses a listed framework with no files', () => {
    item('empty', { tier: 'free', frameworks: ['vue'] }, {});

    expect(() => packLibrary(items)).toThrow(/vue/);
  });
});

describe('main', () => {
  it('writes the packed files to the out dir on --dry-run without credentials', async () => {
    const out = mkdtempSync(join(tmpdir(), 'library-out-'));

    await main(['--dry-run', '--items', items, '--out', out], {});

    expect(JSON.parse(readFileSync(join(out, 'index.json'), 'utf8'))).toHaveLength(2);
    expect(readFileSync(join(out, 'items/hero/svelte.json'), 'utf8')).toContain('Hero.svelte');
    rmSync(out, { recursive: true, force: true });
  });

  it('refuses to upload without explicit credentials', async () => {
    await expect(main(['--items', items], {})).rejects.toThrow(/LIBRARY_PUBLISH_SUPABASE_URL/);
  });

  it('targets the library-pro bucket on upload', () => {
    expect(uploadTarget('https://x.supabase.co/', 'items/a/b.json')).toBe('https://x.supabase.co/storage/v1/object/library-pro/items/a/b.json');
  });
});
