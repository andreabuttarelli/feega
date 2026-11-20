import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { Go } from '@feega/live-edit/go-action';
import { Opens } from '@feega/live-edit/link-edit';
import { fileEdits } from './file-edits';

function project(files: Record<string, string>) {
  const root = mkdtempSync(join(tmpdir(), 'feega-wiring-edits-'));
  for (const [file, text] of Object.entries(files)) {
    mkdirSync(dirname(join(root, file)), { recursive: true });
    writeFileSync(join(root, file), text);
  }
  return root;
}

const read = (root: string, file: string) => readFileSync(join(root, file), 'utf8');
const PLAIN = JSON.stringify({ dependencies: { react: '19' } });
const KIT = JSON.stringify({ dependencies: { svelte: '^5', '@sveltejs/kit': '^2' } });

describe('link edits', () => {
  it('writes the href and one undo restores the file', async () => {
    const root = project({ 'package.json': PLAIN, 'src/A.jsx': `<a href="/a">x</a>` });
    const edits = fileEdits(root);

    const out = await edits.link('src/A.jsx:1:1', { href: '/b' });

    expect(out.ok).toBe(true);
    expect(read(root, 'src/A.jsx')).toBe(`<a href="/b">x</a>`);
    await edits.undo();
    expect(read(root, 'src/A.jsx')).toBe(`<a href="/a">x</a>`);
  });

  it('writes target and rel in one undo step', async () => {
    const root = project({ 'package.json': PLAIN, 'src/A.jsx': `<a href="/a">x</a>` });
    const edits = fileEdits(root);

    await edits.link('src/A.jsx:1:1', { opens: Opens.NewTab });

    expect(read(root, 'src/A.jsx')).toBe(`<a href="/a" target="_blank" rel="noopener noreferrer">x</a>`);
    await edits.undo();
    expect(read(root, 'src/A.jsx')).toBe(`<a href="/a">x</a>`);
    expect(edits.canUndo()).toBe(false);
  });

  it('refuses a computed href and leaves the file alone', async () => {
    const root = project({ 'package.json': PLAIN, 'src/A.jsx': `<a href={url.path}>x</a>` });
    const edits = fileEdits(root);

    const out = await edits.link('src/A.jsx:1:1', { href: '/b' });

    expect(out.ok).toBe(false);
    expect(read(root, 'src/A.jsx')).toBe(`<a href={url.path}>x</a>`);
    expect(edits.canUndo()).toBe(false);
  });

  it('rejects a place outside the workspace', async () => {
    const root = project({ 'package.json': PLAIN });

    expect((await fileEdits(root).link('../x.jsx:1:1', { href: '/b' })).ok).toBe(false);
  });
});

describe('go edits', () => {
  it('adds the handler and the import in one undo step', async () => {
    const root = project({ 'package.json': KIT, 'src/routes/+page.svelte': `<button>Go</button>` });
    const edits = fileEdits(root);

    const out = await edits.go('src/routes/+page.svelte:1:1', { go: Go.Page, target: '/pricing' });

    expect(out.ok).toBe(true);
    expect(read(root, 'src/routes/+page.svelte')).toBe(`<script>\n  import { goto } from '$app/navigation';\n</script>\n\n<button onclick={() => goto('/pricing')}>Go</button>`);
    await edits.undo();
    expect(read(root, 'src/routes/+page.svelte')).toBe(`<button>Go</button>`);
  });

  it('refuses an element that already handles click', async () => {
    const root = project({ 'package.json': PLAIN, 'src/A.jsx': `<button onClick={f}>Go</button>` });
    const edits = fileEdits(root);

    const out = await edits.go('src/A.jsx:1:1', { go: Go.Page, target: '/x' });

    expect(out.ok).toBe(false);
    expect(edits.canUndo()).toBe(false);
  });
});
