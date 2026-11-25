import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { reader } from '@feega/live-edit/live-ask';
import { buildCatalog } from '../../../packages/library/src/catalog';
import { LiveProp } from '@feega/live-edit/live-fields';
import { PageTarget } from '@feega/live-edit/page-rule';
import { fileEdits } from './file-edits';
import { newPage } from './new-page';

function kit(): string {
  const root = mkdtempSync(join(tmpdir(), 'page-'));
  const files: Record<string, string> = { 'package.json': JSON.stringify({ dependencies: { '@sveltejs/kit': '2', svelte: '5' } }), 'src/routes/+page.svelte': '<main></main>\n', 'src/app.css': 'body { margin: 0; }\n' };
  for (const [path, text] of Object.entries(files)) {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), text);
  }
  return root;
}

describe('new page on disk', () => {
  it('writes the route file and library files as one history step, and undo removes them', async () => {
    const root = kit();
    const edits = fileEdits(root);
    const made = await newPage(reader(root), { route: 'pricing', item: 'pricing', catalog: buildCatalog() });
    if (!made.ok) {
      throw new Error(made.reason);
    }

    const out = await edits.page(made.route, made.changes);

    expect(out.ok).toBe(true);
    expect(readFileSync(join(root, 'src/routes/pricing/+page.svelte'), 'utf8')).toContain('<Pricing />');
    expect(existsSync(join(root, 'src/lib/components/feega/Pricing.svelte'))).toBe(true);
    expect(edits.history()).toHaveLength(1);
    expect(edits.history()[0]).toMatchObject({ prop: 'page', value: '/pricing' });

    await edits.undo();

    expect(existsSync(join(root, 'src/routes/pricing/+page.svelte'))).toBe(false);
  });
});

describe('page style in a new global block', () => {
  it('tells the caller a style block was created, not on the second edit', async () => {
    const root = mkdtempSync(join(tmpdir(), 'page-'));
    mkdirSync(join(root, 'src/layouts'), { recursive: true });
    writeFileSync(join(root, 'package.json'), '{}');
    writeFileSync(join(root, 'src/layouts/Layout.astro'), '<html><body><slot /></body></html>\n');
    const edits = fileEdits(root);
    const ask = { at: 'page', prop: LiveProp.Color, value: '#111111', page: PageTarget.Body, css: { 'background-color': '#111111' } };

    const first = await edits.edit(ask);
    const second = await edits.edit({ ...ask, value: '#222222', css: { 'background-color': '#222222' } });

    expect(first).toMatchObject({ ok: true, created: true });
    expect(second).toMatchObject({ ok: true });
    expect(second.ok && second.created).toBeFalsy();
  });
});
