import { mkdtempSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { LiveProp, Side } from '@feega/live-edit/live-fields';
import { fileEdits } from './file-edits';

const PAGE = `<section class="px-4 py-8 text-black">
  <h1 class="text-2xl">Hello</h1>
</section>
`;

function app(): string {
  const root = mkdtempSync(join(tmpdir(), 'inspect-'));
  mkdirSync(join(root, 'src'));
  writeFileSync(join(root, 'src/Page.svelte'), PAGE);
  return root;
}

const read = (root: string) => readFileSync(join(root, 'src/Page.svelte'), 'utf8');

describe('fileEdits', () => {
  it('il padding scrive la sola classe px, in token', async () => {
    const root = app();
    const out = await fileEdits(root).edit({ at: 'src/Page.svelte:1:1', prop: LiveProp.Padding, side: Side.X, value: '24px', rem: 16 });

    expect(out.ok).toBe(true);
    expect(read(root)).toContain('class="px-6 py-8 text-black"');
  });

  it('il colore scrive la sola classe colore', async () => {
    const root = app();
    await fileEdits(root).edit({ at: 'src/Page.svelte:2:3', prop: LiveProp.Color, value: '#ff0000' });

    expect(read(root)).toContain('<h1 class="text-2xl text-[#ff0000]">');
  });

  it('undo rimette il file com era', async () => {
    const root = app();
    const edits = fileEdits(root);
    await edits.edit({ at: 'src/Page.svelte:1:1', prop: LiveProp.Padding, side: Side.Y, value: '16px', rem: 16 });
    await edits.undo();

    expect(read(root)).toBe(PAGE);
  });

  it('undo non sovrascrive quello che è cambiato dopo', async () => {
    const root = app();
    const edits = fileEdits(root);
    await edits.edit({ at: 'src/Page.svelte:1:1', prop: LiveProp.Padding, side: Side.Y, value: '16px', rem: 16 });
    writeFileSync(join(root, 'src/Page.svelte'), 'changed by someone else');

    expect((await edits.undo()).ok).toBe(false);
    expect(read(root)).toBe('changed by someone else');
  });

  it('un percorso fuori dalla cartella si rifiuta', async () => {
    const out = await fileEdits(app()).edit({ at: '../x.svelte:1:1', prop: LiveProp.Padding, value: '4px' });

    expect(out.ok).toBe(false);
  });

  it('il testo non si scrive', async () => {
    const out = await fileEdits(app()).edit({ at: 'src/Page.svelte:2:3', prop: LiveProp.Text, value: 'Hi' });

    expect(out.ok).toBe(false);
  });
});
