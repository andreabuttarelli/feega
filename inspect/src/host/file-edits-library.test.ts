import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { AddPlace } from '@feega/live-edit/add-node';
import type { InsertItem } from '@feega/live-edit/library-insert';
import { fileEdits } from './file-edits';

const ITEM: InsertItem = {
  id: 'pricing',
  component: 'Pricing',
  fonts: [{ family: 'Inter Tight', weights: [400] }],
  files: {
    svelte: [{ name: 'Pricing.svelte', text: '<section class="fl-pricing"></section>\n' }],
    react: [],
    vue: [],
    astro: []
  }
};

const PAGE = '<main>\n  <h1>Title</h1>\n</main>\n';
const SHEET = 'body { margin: 0; }\n';
const TOKENS = ':root { --feega-ink: #111; }\n';
const AT = 'src/routes/+page.svelte:2:3';

function kit(): string {
  const root = mkdtempSync(join(tmpdir(), 'library-'));
  const files: Record<string, string> = { 'package.json': JSON.stringify({ dependencies: { '@sveltejs/kit': '2', svelte: '5' } }), 'src/routes/+page.svelte': PAGE, 'src/app.css': SHEET };
  for (const [path, text] of Object.entries(files)) {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), text);
  }
  return root;
}

const text = (root: string, path: string) => readFileSync(join(root, path), 'utf8');

describe('library insert', () => {
  it('writes every file of the proposal as one history step', async () => {
    const root = kit();
    const edits = fileEdits(root);
    const out = await edits.library(AT, AddPlace.After, ITEM, TOKENS);

    expect(out.ok).toBe(true);
    expect(text(root, 'src/lib/components/feega/Pricing.svelte')).toBe(ITEM.files.svelte[0].text);
    expect(text(root, 'src/lib/components/feega/tokens.css')).toBe(TOKENS);
    expect(text(root, 'src/app.css')).toContain('tokens.css');
    expect(text(root, 'src/routes/+page.svelte')).toContain('<Pricing />');
    expect(edits.history()).toHaveLength(1);
    expect(edits.history()[0]).toMatchObject({ prop: 'library', value: 'pricing' });
    expect(edits.history()[0].files).toHaveLength(4);
  });

  it('undoes the whole insert in one step and redoes it', async () => {
    const root = kit();
    const edits = fileEdits(root);
    await edits.library(AT, AddPlace.After, ITEM, TOKENS);
    const inserted = text(root, 'src/routes/+page.svelte');

    expect((await edits.undo()).ok).toBe(true);
    expect(text(root, 'src/routes/+page.svelte')).toBe(PAGE);
    expect(text(root, 'src/app.css')).toBe(SHEET);
    expect(existsSync(join(root, 'src/lib/components/feega/Pricing.svelte'))).toBe(false);
    expect(existsSync(join(root, 'src/lib/components/feega/tokens.css'))).toBe(false);
    expect(edits.canUndo()).toBe(false);

    expect((await edits.redo()).ok).toBe(true);
    expect(text(root, 'src/routes/+page.svelte')).toBe(inserted);
    expect(existsSync(join(root, 'src/lib/components/feega/Pricing.svelte'))).toBe(true);
  });

  it('refuses a position outside the workspace', async () => {
    const out = await fileEdits(kit()).library('../elsewhere/+page.svelte:1:1', AddPlace.After, ITEM, TOKENS);
    expect(out.ok).toBe(false);
  });
});
