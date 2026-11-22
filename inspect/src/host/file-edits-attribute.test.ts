import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { fileEdits } from './file-edits';

const SECTION = '<section class="tunnel" data-speed="0.9">\n  <h2>Hi</h2>\n</section>\n';

function app(files: Record<string, string>): string {
  const root = mkdtempSync(join(tmpdir(), 'attribute-'));
  mkdirSync(join(root, 'src'));
  writeFileSync(join(root, 'package.json'), '{}');
  Object.entries(files).forEach(([path, text]) => writeFileSync(join(root, path), text));
  return root;
}

describe('attribute edit', () => {
  it('writes a data attribute into the source and can be undone', async () => {
    const root = app({ 'src/Tunnel.html': SECTION });
    const edits = fileEdits(root);

    const out = await edits.attribute('src/Tunnel.html:1:1', 'data-speed', '2');

    expect(out.ok).toBe(true);
    expect(readFileSync(join(root, 'src/Tunnel.html'), 'utf8')).toBe(SECTION.replace('0.9', '2'));
    await edits.undo();
    expect(readFileSync(join(root, 'src/Tunnel.html'), 'utf8')).toBe(SECTION);
  });

  it('refuses a position outside the workspace', async () => {
    const out = await fileEdits(app({})).attribute('../x.html:1:1', 'data-speed', '2');

    expect(out.ok).toBe(false);
  });

  it('refuses an attribute that is not editable', async () => {
    const root = app({ 'src/Tunnel.html': SECTION });

    expect((await fileEdits(root).attribute('src/Tunnel.html:1:1', 'class', 'x')).ok).toBe(false);
  });
});
