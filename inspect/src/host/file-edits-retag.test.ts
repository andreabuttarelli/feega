import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { fileEdits } from './file-edits';

const PAGE = '<main>\n  <p class="lead">Hi</p>\n</main>\n';

function app(): string {
  const root = mkdtempSync(join(tmpdir(), 'retag-'));
  mkdirSync(join(root, 'src'));
  writeFileSync(join(root, 'package.json'), '{}');
  writeFileSync(join(root, 'src/Page.svelte'), PAGE);
  return root;
}

describe('retag edit', () => {
  it('renames the tag in the source, selects it again and can be undone and redone', async () => {
    const root = app();
    const edits = fileEdits(root);

    const out = await edits.retag('src/Page.svelte:2:3', 'h2');

    expect(out.ok && out.selected).toEqual({ file: 'src/Page.svelte', line: 2, col: 3 });
    expect(readFileSync(join(root, 'src/Page.svelte'), 'utf8')).toBe(PAGE.replace(/<(\/?)p/g, '<$1h2'));
    await edits.undo();
    expect(readFileSync(join(root, 'src/Page.svelte'), 'utf8')).toBe(PAGE);
    await edits.redo();
    expect(readFileSync(join(root, 'src/Page.svelte'), 'utf8')).toBe(PAGE.replace(/<(\/?)p/g, '<$1h2'));
  });

  it('refuses a position outside the workspace', async () => {
    expect((await fileEdits(app()).retag('../x.svelte:1:1', 'h2')).ok).toBe(false);
  });
});
