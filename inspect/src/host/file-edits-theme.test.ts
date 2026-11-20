import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ClassFamily, LiveProp } from '@feega/live-edit/live-fields';
import { fileEdits } from './file-edits';

const TAILWIND = JSON.stringify({ devDependencies: { tailwindcss: '^3.4.0' } });
const PLAIN = JSON.stringify({ devDependencies: { vite: '^5.0.0' } });
const CLASS_DARK = "export default { darkMode: 'class' }";
const PAGE = '<section class="px-4 py-8">\n  <h1>Hello</h1>\n</section>\n';
const STYLED = '<h1 class="title">Hello</h1>\n\n<style>\n  .title {\n    font-size: 20px;\n  }\n</style>\n';

function app(manifest: string, page: string, extra: Record<string, string> = {}): string {
  const root = mkdtempSync(join(tmpdir(), 'theme-'));
  mkdirSync(join(root, 'src'));
  writeFileSync(join(root, 'package.json'), manifest);
  writeFileSync(join(root, 'src/Page.svelte'), page);
  Object.entries(extra).forEach(([path, text]) => writeFileSync(join(root, path), text));
  return root;
}

const read = (root: string) => readFileSync(join(root, 'src/Page.svelte'), 'utf8');

const hide = { at: 'src/Page.svelte:1:1', prop: LiveProp.Class, family: ClassFamily.Display, value: 'hidden' };
const size = { at: 'src/Page.svelte:1:1', prop: LiveProp.FontSize, value: '32px', css: { 'font-size': '32px' } };

describe('a style edit under a theme', () => {
  it('writes the dark: variant in a Tailwind project', async () => {
    const root = app(TAILWIND, PAGE, { 'tailwind.config.js': CLASS_DARK });
    const out = await fileEdits(root).edit({ ...hide, theme: 'dark' });

    expect(out.ok).toBe(true);
    expect(read(root)).toContain('class="px-4 py-8 dark:hidden"');
  });

  it('combines the breakpoint, the theme and the state', async () => {
    const root = app(TAILWIND, PAGE, { 'tailwind.config.js': CLASS_DARK });
    await fileEdits(root).edit({ ...hide, theme: 'dark', breakpoint: 'md' });

    expect(read(root)).toContain('md:dark:hidden');
  });

  it('writes a rule under the class theme in a CSS project', async () => {
    const root = app(PLAIN, STYLED, { 'src/app.css': '.dark { --bg: #000 }' });
    await fileEdits(root).edit({ ...size, theme: 'dark' });

    expect(read(root)).toContain(':global(.dark) .title {\n    font-size: 32px;');
    expect(read(root)).toContain('.title {\n    font-size: 20px;');
  });

  it('writes into the prefers-color-scheme block for a media theme', async () => {
    const root = app(PLAIN, STYLED, { 'src/app.css': '@media (prefers-color-scheme: dark) { body { color: white } }' });
    await fileEdits(root).edit({ ...size, theme: 'dark' });

    expect(read(root)).toContain('@media (prefers-color-scheme: dark) {\n    .title {\n      font-size: 32px;');
  });

  it('joins a breakpoint to a media theme in one query', async () => {
    const root = app(PLAIN, STYLED, { 'src/app.css': '@media (prefers-color-scheme: dark) { body { color: white } }' });
    await fileEdits(root).edit({ ...size, theme: 'dark', breakpoint: 'md' });

    expect(read(root)).toContain('@media (min-width: 768px) and (prefers-color-scheme: dark) {');
  });

  it('writes under an attribute theme', async () => {
    const root = app(PLAIN, STYLED, { 'src/app.css': '[data-theme="forest"] { --bg: green }' });
    await fileEdits(root).edit({ ...size, theme: 'forest' });

    expect(read(root)).toContain(':global([data-theme="forest"]) .title');
  });

  it('writes the base value on the default theme', async () => {
    const root = app(TAILWIND, PAGE, { 'tailwind.config.js': CLASS_DARK });
    await fileEdits(root).edit({ ...hide, theme: 'default' });

    expect(read(root)).toContain('class="px-4 py-8 hidden"');
  });

  it('refuses a theme the project does not have', async () => {
    const root = app(TAILWIND, PAGE);
    const out = await fileEdits(root).edit({ ...hide, theme: 'dark' });

    expect(out.ok).toBe(false);
    expect(read(root)).toBe(PAGE);
  });

  it('refuses a Tailwind edit under a theme that has no variant', async () => {
    const root = app(JSON.stringify({ devDependencies: { tailwindcss: '^3', daisyui: '^4' } }), PAGE, { 'tailwind.config.js': 'module.exports = { daisyui: { themes: ["cupcake"] } }' });
    const out = await fileEdits(root).edit({ ...hide, theme: 'cupcake' });

    expect(out.ok).toBe(false);
    expect(!out.ok && out.reason).toContain('cupcake');
    expect(read(root)).toBe(PAGE);
  });
});
