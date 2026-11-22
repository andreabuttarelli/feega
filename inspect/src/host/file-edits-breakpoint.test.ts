import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ALL_SIZES } from '@feega/live-edit/breakpoints';
import { ClassFamily, LiveProp, arbitraryFamily } from '@feega/live-edit/live-fields';
import { tailwindToken } from '@feega/live-edit/tailwind-property';
import { fileEdits } from './file-edits';

const TAILWIND = JSON.stringify({ devDependencies: { tailwindcss: '^4.0.0' } });
const PLAIN = JSON.stringify({ devDependencies: { vite: '^5.0.0' } });
const PAGE = '<section class="px-4 py-8">\n  <h1>Hello</h1>\n</section>\n';
const STYLED = '<h1 class="title">Hello</h1>\n\n<style>\n  .title {\n    font-size: 20px;\n  }\n</style>\n';

function app(manifest: string, page: string, extra: Record<string, string> = {}): string {
  const root = mkdtempSync(join(tmpdir(), 'resp-'));
  mkdirSync(join(root, 'src'));
  writeFileSync(join(root, 'package.json'), manifest);
  writeFileSync(join(root, 'src/Page.svelte'), page);
  Object.entries(extra).forEach(([path, text]) => writeFileSync(join(root, path), text));
  return root;
}

const read = (root: string) => readFileSync(join(root, 'src/Page.svelte'), 'utf8');

const maxWidth = (value: string, breakpoint?: string) => ({ at: 'src/Page.svelte:1:1', prop: LiveProp.Class, family: arbitraryFamily('max-width'), value: tailwindToken('max-width', value), css: { 'max-width': value }, breakpoint });

describe('a max-width edit at a breakpoint', () => {
  it('writes max-w-[720px] at md in a Tailwind project', async () => {
    const root = app(TAILWIND, '<section class="px-4 max-w-prose">x</section>\n');
    const out = await fileEdits(root).edit(maxWidth('720px', 'md'));

    expect(out.ok).toBe(true);
    expect(read(root)).toContain('class="px-4 max-w-prose md:max-w-[720px]"');
  });

  it('writes the theme scale class for all sizes', async () => {
    const root = app(TAILWIND, '<section class="max-w-[10px] md:max-w-sm">x</section>\n');
    await fileEdits(root).edit(maxWidth('65ch', ALL_SIZES));

    expect(read(root)).toContain('class="max-w-prose md:max-w-sm"');
  });

  it('clears the limit at one breakpoint only', async () => {
    const root = app(TAILWIND, '<section class="max-w-prose md:max-w-[720px]">x</section>\n');
    await fileEdits(root).edit(maxWidth('', 'md'));

    expect(read(root)).toContain('class="max-w-prose"');
  });

  it('writes the declaration inside the media query in a CSS project', async () => {
    const root = app(PLAIN, STYLED);
    await fileEdits(root).edit(maxWidth('720px', 'md'));

    expect(read(root)).toContain('@media (min-width: 768px) {\n    .title {\n      max-width: 720px;');
  });

  it('writes a keyword declaration to the rule', async () => {
    const root = app(PLAIN, STYLED);
    await fileEdits(root).edit(maxWidth('none'));

    expect(read(root)).toContain('max-width: none;');
  });
});

describe('a style edit at a breakpoint', () => {
  it('writes a prefixed Tailwind class at the chosen breakpoint', async () => {
    const root = app(TAILWIND, PAGE);
    const out = await fileEdits(root).edit({ at: 'src/Page.svelte:1:1', prop: LiveProp.Class, family: ClassFamily.Display, value: 'hidden', breakpoint: 'md' });

    expect(out.ok).toBe(true);
    expect(read(root)).toContain('class="px-4 py-8 md:hidden"');
  });

  it('uses the breakpoints the project defines', async () => {
    const root = app(TAILWIND, PAGE, { 'src/app.css': '@theme { --breakpoint-tablet: 700px; }' });
    await fileEdits(root).edit({ at: 'src/Page.svelte:1:1', prop: LiveProp.Class, family: ClassFamily.Display, value: 'hidden', breakpoint: 'tablet' });

    expect(read(root)).toContain('tablet:hidden');
  });

  it('writes the base class for all sizes', async () => {
    const root = app(TAILWIND, '<section class="px-4 md:px-8">x</section>\n');
    await fileEdits(root).edit({ at: 'src/Page.svelte:1:1', prop: LiveProp.Padding, side: '' as never, value: '8px', rem: 16, breakpoint: ALL_SIZES });

    expect(read(root)).toContain('class="p-2 md:px-8"');
  });

  it('writes a media query rule for a CSS project', async () => {
    const root = app(PLAIN, STYLED);
    await fileEdits(root).edit({ at: 'src/Page.svelte:1:1', prop: LiveProp.FontSize, value: '32px', css: { 'font-size': '32px' }, breakpoint: 'md' });

    expect(read(root)).toContain('@media (min-width: 768px) {\n    .title {\n      font-size: 32px;');
    expect(read(root)).toContain('font-size: 20px;');
  });

  it('writes max-width queries when the project is desktop-first', async () => {
    const root = app(PLAIN, STYLED, { 'src/a.css': '@media (max-width: 900px) {}', 'src/b.css': '@media (max-width: 600px) {}' });
    await fileEdits(root).edit({ at: 'src/Page.svelte:1:1', prop: LiveProp.FontSize, value: '12px', css: { 'font-size': '12px' }, breakpoint: '900px' });

    expect(read(root)).toContain('@media (max-width: 900px) {');
  });

  it('refuses a breakpoint the project does not have', async () => {
    const root = app(TAILWIND, PAGE);
    const out = await fileEdits(root).edit({ at: 'src/Page.svelte:1:1', prop: LiveProp.Class, family: ClassFamily.Display, value: 'hidden', breakpoint: 'huge' });

    expect(out.ok).toBe(false);
    expect(read(root)).toBe(PAGE);
  });

  it('keeps the old behaviour when no breakpoint is asked', async () => {
    const root = app(TAILWIND, PAGE);
    await fileEdits(root).edit({ at: 'src/Page.svelte:1:1', prop: LiveProp.Class, family: ClassFamily.Display, value: 'hidden' });

    expect(read(root)).toContain('class="px-4 py-8 hidden"');
  });
});
