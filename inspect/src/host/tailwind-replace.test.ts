import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { LiveProp, Side, arbitraryFamily } from '@feega/live-edit/live-fields';
import { fileEdits } from './file-edits';

const TAILWIND = JSON.stringify({ devDependencies: { tailwindcss: '^4.0.0' } });

async function classAfter(classes: string, ask: { prop: LiveProp; side?: Side; family?: string; value: string }) {
  const root = mkdtempSync(join(tmpdir(), 'tw-replace-'));
  mkdirSync(join(root, 'src'));
  writeFileSync(join(root, 'package.json'), TAILWIND);
  writeFileSync(join(root, 'src/Page.svelte'), `<div class="${classes}">x</div>\n`);
  await fileEdits(root).edit({ at: 'src/Page.svelte:1:1', rem: 16, ...ask });
  return readFileSync(join(root, 'src/Page.svelte'), 'utf8').match(/class="([^"]*)"/)![1];
}

describe('a Tailwind edit replaces what it conflicts with', () => {
  it('padding on all sides drops the axis utilities', async () => {
    expect(await classAfter('px-6 py-3 text-sm', { prop: LiveProp.Padding, value: '30px' })).toBe('p-[30px] text-sm');
  });

  it('padding on one axis drops its side utilities', async () => {
    expect(await classAfter('pl-2 pr-4 py-3', { prop: LiveProp.Padding, side: Side.X, value: '24px' })).toBe('px-6 py-3');
  });

  it('padding on one side leaves the other sides', async () => {
    expect(await classAfter('pt-2 pb-2', { prop: LiveProp.Padding, side: Side.Top, value: '8px' })).toBe('pt-2 pb-2');
  });

  it('a border colour replaces the colour utility', async () => {
    expect(await classAfter('border border-slate-200', { prop: LiveProp.Class, family: arbitraryFamily('border-color'), value: 'border-[#f00]' })).toBe('border border-[#f00]');
  });

  it('a cursor replaces the cursor utility', async () => {
    expect(await classAfter('cursor-pointer p-2', { prop: LiveProp.Class, family: arbitraryFamily('cursor'), value: 'cursor-grab' })).toBe('cursor-grab p-2');
  });

  it('grid columns replace grid-cols', async () => {
    expect(await classAfter('grid grid-cols-3', { prop: LiveProp.Class, family: arbitraryFamily('grid-template-columns'), value: 'grid-cols-[1fr_2fr]' })).toBe('grid grid-cols-[1fr_2fr]');
  });

  it('the same edit twice leaves one token', async () => {
    expect(await classAfter('[min-width:240px] [min-width:240px]', { prop: LiveProp.Class, family: arbitraryFamily('min-width'), value: 'min-w-[200px]' })).toBe('min-w-[200px]');
  });
});
