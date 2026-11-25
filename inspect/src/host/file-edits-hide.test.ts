import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ClassFamily, LiveProp } from '@feega/live-edit/live-fields';
import { Scope } from '@feega/live-edit/scoped-rule';
import { fileEdits } from './file-edits';

const TAILWIND = JSON.stringify({ devDependencies: { tailwindcss: '^3.4.0' } });
const PLAIN = JSON.stringify({ devDependencies: { vite: '^5.0.0' } });

const FOOTER = `<footer>
  <nav class="quick">
    <a href="/a">A</a>
    <a href="/b">B</a>
  </nav>
</footer>

<style>
  .quick {
    display: flex;
    flex-wrap: wrap;
    gap: 10px 24px;
    margin-top: 48px;
  }
</style>
`;

const SHARED = `<nav class="quick">A</nav>
<nav class="quick">B</nav>

<style>
  .quick {
    display: flex;
  }
</style>
`;

const TAILWIND_NAV = '<nav class="flex gap-4">\n  <a href="/a">A</a>\n</nav>\n';
const MODULE_NAV = "import styles from './Nav.module.css';\n\nexport const Nav = () => (\n  <nav className={styles.quick}>A</nav>\n);\n";
const MODULE_CSS = '.quick {\n  display: flex;\n}\n';
const PLAIN_NAV = '<nav>A</nav>\n';

function app(manifest: string, files: Record<string, string>): string {
  const root = mkdtempSync(join(tmpdir(), 'hide-'));
  mkdirSync(join(root, 'src'));
  writeFileSync(join(root, 'package.json'), manifest);
  Object.entries(files).forEach(([path, text]) => writeFileSync(join(root, path), text));
  return root;
}

const read = (root: string, path: string) => readFileSync(join(root, path), 'utf8');

const toggle = (at: string, hide: boolean, scope?: Scope) => ({
  at,
  prop: LiveProp.Class,
  family: ClassFamily.Hidden,
  value: hide ? 'hidden' : '',
  css: { display: hide ? 'none' : '' },
  scope
});

async function hideThenShow(root: string, at: string, scope?: Scope) {
  const hidden = await fileEdits(root).edit(toggle(at, true, scope));
  const shown = await fileEdits(root).edit(toggle(at, false, scope));
  return { hidden, shown };
}

describe('hide then show', () => {
  it('leaves a scoped Svelte rule byte-identical', async () => {
    const root = app(PLAIN, { 'src/Footer.svelte': FOOTER });
    const { hidden } = await hideThenShow(root, 'src/Footer.svelte:2:3', Scope.Element);

    expect(hidden.ok).toBe(true);
    expect(read(root, 'src/Footer.svelte')).toBe(FOOTER);
  });

  it('keeps display: flex while the element is hidden', async () => {
    const root = app(PLAIN, { 'src/Footer.svelte': FOOTER });
    await fileEdits(root).edit(toggle('src/Footer.svelte:2:3', true, Scope.Element));

    const hidden = read(root, 'src/Footer.svelte');
    expect(hidden).toContain('display: flex;');
    expect(hidden).toContain('display: none');
  });

  it('does not touch a rule shared by several elements', async () => {
    const root = app(PLAIN, { 'src/Footer.svelte': SHARED });
    await fileEdits(root).edit(toggle('src/Footer.svelte:1:1', true, Scope.Class));

    const hidden = read(root, 'src/Footer.svelte');
    expect(hidden).toContain('.quick {\n    display: flex;\n  }');
    expect(hidden.match(/display: none/g)).toHaveLength(1);

    await fileEdits(root).edit(toggle('src/Footer.svelte:1:1', false, Scope.Class));
    expect(read(root, 'src/Footer.svelte')).toBe(SHARED);
  });

  it('leaves a Tailwind class list byte-identical', async () => {
    const root = app(TAILWIND, { 'src/Nav.svelte': TAILWIND_NAV });
    const { hidden } = await hideThenShow(root, 'src/Nav.svelte:1:1');

    expect(hidden.ok).toBe(true);
    expect(read(root, 'src/Nav.svelte')).toBe(TAILWIND_NAV);
  });

  it('adds hidden next to flex in Tailwind', async () => {
    const root = app(TAILWIND, { 'src/Nav.svelte': TAILWIND_NAV });
    await fileEdits(root).edit(toggle('src/Nav.svelte:1:1', true));

    expect(read(root, 'src/Nav.svelte')).toContain('class="flex gap-4 hidden"');
  });

  it('leaves a CSS module rule byte-identical', async () => {
    const root = app(PLAIN, { 'src/Nav.tsx': MODULE_NAV, 'src/Nav.module.css': MODULE_CSS });
    const { hidden, shown } = await hideThenShow(root, 'src/Nav.tsx:4:3');

    expect(hidden.ok).toBe(true);
    expect(shown.ok).toBe(true);
    expect(read(root, 'src/Nav.tsx')).toBe(MODULE_NAV);
    expect(read(root, 'src/Nav.module.css')).toBe(MODULE_CSS);
  });

  it('leaves an element with no stylesheet byte-identical', async () => {
    const root = app(PLAIN, { 'src/Nav.html': PLAIN_NAV });
    const { hidden } = await hideThenShow(root, 'src/Nav.html:1:1');

    expect(hidden.ok).toBe(true);
    expect(read(root, 'src/Nav.html')).toBe(PLAIN_NAV);
  });

  it('leaves an existing inline style byte-identical', async () => {
    const page = '<nav style="color: red">A</nav>\n';
    const root = app(PLAIN, { 'src/Nav.html': page });
    await hideThenShow(root, 'src/Nav.html:1:1');

    expect(read(root, 'src/Nav.html')).toBe(page);
  });
});
