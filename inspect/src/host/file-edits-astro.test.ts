import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { LiveProp } from '@feega/live-edit/live-fields';
import { fileEdits } from './file-edits';

const PLAIN = JSON.stringify({ devDependencies: { vite: '^5.0.0' } });
const FILE = 'src/Card.astro';

const CARD = `<article>
  <h3>Title</h3>
</article>

<style>
  h3 {
    font-size: 20px;
  }
</style>
`;

function app(): string {
  const root = mkdtempSync(join(tmpdir(), 'astro-'));
  mkdirSync(join(root, 'src'));
  writeFileSync(join(root, 'package.json'), PLAIN);
  writeFileSync(join(root, FILE), CARD);
  return root;
}

const editAsk = { at: `${FILE}:2:3`, prop: LiveProp.FontSize, value: '44px', css: { 'font-size': '44px' } };

describe('astro scoped style', () => {
  it('compila la pagina tra il markup e la regola, cosi la seconda scrittura e solo di stile', async () => {
    const root = app();
    const seen: string[] = [];
    const edits = fileEdits(root, undefined, undefined, async () => {
      seen.push(readFileSync(join(root, FILE), 'utf8'));
    });

    const out = await edits.edit(editAsk);

    expect(out.ok).toBe(true);
    expect(seen).toHaveLength(1);
    expect(seen[0]).toContain('class="card-h3"');
    expect(seen[0]).toContain('font-size: 20px');
    expect(seen[0]).not.toContain('44px');
    expect(readFileSync(join(root, FILE), 'utf8')).toContain('44px');
  });

  it('non aspetta niente quando cambia solo lo stile', async () => {
    const root = app();
    writeFileSync(join(root, FILE), CARD.replace('<h3>', '<h3 class="card-h3">').replace('  h3 {', '  .card-h3 {'));
    let waited = 0;
    const edits = fileEdits(root, undefined, undefined, async () => void waited++);

    await edits.edit({ ...editAsk, at: `${FILE}:2:3` });

    expect(waited).toBe(0);
  });

  it('annulla e ripete con la stessa pausa', async () => {
    const root = app();
    let waited = 0;
    const edits = fileEdits(root, undefined, undefined, async () => void waited++);
    await edits.edit(editAsk);

    await edits.undo();
    await edits.redo();

    expect(waited).toBe(3);
    expect(readFileSync(join(root, FILE), 'utf8')).toContain('44px');
  });
});
