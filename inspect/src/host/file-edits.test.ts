import { existsSync, mkdtempSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { LiveProp, Side } from '@feega/live-edit/live-fields';
import { fileEdits } from './file-edits';
import { Place } from '@feega/live-edit/move-node';

const PAGE = `<section class="px-4 py-8 text-black">
  <h1 class="text-2xl">Hello</h1>
  <p>{subtitle}</p>
</section>
`;

const TAILWIND = JSON.stringify({ devDependencies: { tailwindcss: '^4.0.0' } });
const PLAIN = JSON.stringify({ devDependencies: { vite: '^5.0.0' } });

function app(manifest = TAILWIND): string {
  const root = mkdtempSync(join(tmpdir(), 'inspect-'));
  mkdirSync(join(root, 'src'));
  writeFileSync(join(root, 'package.json'), manifest);
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

  it('il testo letterale cambia una riga sola, e undo lo rimette', async () => {
    const root = app();
    const edits = fileEdits(root);
    await edits.edit({ at: 'src/Page.svelte:2:3', prop: LiveProp.Text, value: 'Ciao' });

    expect(read(root).split('\n').filter((l, i) => l !== PAGE.split('\n')[i])).toEqual(['  <h1 class="text-2xl">Ciao</h1>']);
    await edits.undo();
    expect(read(root)).toBe(PAGE);
  });

  it('il testo da un espressione si rifiuta e dice dove sta', async () => {
    const out = await fileEdits(app()).edit({ at: 'src/Page.svelte:3:3', prop: LiveProp.Text, value: 'x' });

    expect(out).toEqual({ ok: false, reason: 'This text comes from `{subtitle}`.', at: { file: 'src/Page.svelte', line: 3, col: 6 } });
  });

  it('senza Tailwind scrive una regola nello <style> del componente, non uno style inline', async () => {
    const root = app(PLAIN);
    await fileEdits(root).edit({ at: 'src/Page.svelte:2:3', prop: LiveProp.FontWeight, value: '700', css: { 'font-weight': '700' } });

    expect(read(root)).toContain('<h1 class="text-2xl page-h1">Hello</h1>');
    expect(read(root)).toContain('  .page-h1 {\n    font-weight: 700;\n  }');
  });

  it('undo toglie la regola e la classe aggiunte', async () => {
    const root = app(PLAIN);
    const edits = fileEdits(root);
    await edits.edit({ at: 'src/Page.svelte:3:3', prop: LiveProp.Color, value: 'red', css: { color: 'red' } });
    await edits.undo();

    expect(read(root)).toBe(PAGE);
  });

  it('spostare un fratello cambia l ordine nel sorgente, e undo lo rimette', async () => {
    const root = app();
    const edits = fileEdits(root);
    await edits.move('src/Page.svelte:3:3', 'src/Page.svelte:2:3', Place.Before);

    expect(read(root)).toBe('<section class="px-4 py-8 text-black">\n  <p>{subtitle}</p>\n  <h1 class="text-2xl">Hello</h1>\n</section>\n');
    await edits.undo();
    expect(read(root)).toBe(PAGE);
  });

  it('redo riapplica un passo su piu file, e un cambio esterno lo blocca', async () => {
    const root = app(PLAIN);
    writeFileSync(join(root, 'src/App.tsx'), 'export const App = () => <h1>Hi</h1>;\n');
    const edits = fileEdits(root);
    await edits.edit({ at: 'src/App.tsx:1:26', prop: LiveProp.Color, value: 'red', css: { color: 'red' } });
    const afterEdit = readFileSync(join(root, 'src/App.tsx'), 'utf8');
    await edits.undo();
    await edits.redo();

    expect(readFileSync(join(root, 'src/App.tsx'), 'utf8')).toBe(afterEdit);
    expect(existsSync(join(root, 'src/App.module.css'))).toBe(true);

    await edits.undo();
    writeFileSync(join(root, 'src/App.tsx'), 'changed outside');
    expect((await edits.redo()).ok).toBe(false);
  });

  it('la cronologia elenca le modifiche, la piu recente prima', async () => {
    const root = app();
    const edits = fileEdits(root);
    await edits.edit({ at: 'src/Page.svelte:1:1', prop: LiveProp.Padding, side: Side.X, value: '24px', rem: 16 });
    await edits.edit({ at: 'src/Page.svelte:2:3', prop: LiveProp.Color, value: '#ff0000' });

    expect(edits.history().map((h) => [h.prop, h.files])).toEqual([
      [LiveProp.Color, ['src/Page.svelte']],
      [LiveProp.Padding, ['src/Page.svelte']]
    ]);
  });

  it('un font Google scrive la famiglia e lo importa nel foglio globale, un passo solo', async () => {
    const root = app(PLAIN);
    writeFileSync(join(root, 'src/app.css'), ':root {}\n');
    const edits = fileEdits(root);
    await edits.font({ at: 'src/Page.svelte:2:3', prop: LiveProp.Class, value: 'Space Grotesk', css: { 'font-family': "'Space Grotesk', sans-serif" } }, true);

    expect(readFileSync(join(root, 'src/app.css'), 'utf8')).toContain('family=Space+Grotesk');
    expect(read(root)).toContain("font-family: 'Space Grotesk', sans-serif;");
    await edits.undo();
    expect(readFileSync(join(root, 'src/app.css'), 'utf8')).toBe(':root {}\n');
    expect(read(root)).toBe(PAGE);
  });

  it('salva un colore come variabile: @theme con Tailwind v4, poi la classe del token', async () => {
    const root = app();
    writeFileSync(join(root, 'src/app.css'), '@import "tailwindcss";\n');
    await fileEdits(root).saveVariable({ at: 'src/Page.svelte:2:3', prop: LiveProp.Color, value: '#0078d4', css: { color: '#0078d4' } }, 'brand');

    expect(readFileSync(join(root, 'src/app.css'), 'utf8')).toContain('--color-brand: #0078d4;');
    expect(read(root)).toContain('<h1 class="text-2xl text-brand">');
  });

  it('senza Tailwind la variabile va in :root e la regola usa var()', async () => {
    const root = app(PLAIN);
    writeFileSync(join(root, 'src/app.css'), 'body {}\n');
    await fileEdits(root).saveVariable({ at: 'src/Page.svelte:2:3', prop: LiveProp.Color, value: '#0078d4', css: { color: '#0078d4' } }, 'brand');

    expect(readFileSync(join(root, 'src/app.css'), 'utf8')).toContain(':root {\n  --brand: #0078d4;\n}');
    expect(read(root)).toContain('color: var(--brand);');
  });

  it('cronologia e undo sopravvivono a una nuova sessione', async () => {
    const root = app();
    const first = fileEdits(root);
    await first.edit({ at: 'src/Page.svelte:2:3', prop: LiveProp.Color, value: '#ff0000' });
    const second = fileEdits(root, undefined, JSON.parse(JSON.stringify(first.snapshot())));

    expect(second.history()).toHaveLength(1);
    await second.undo();
    expect(read(root)).toBe(PAGE);
  });

  it('in JSX senza Tailwind crea il CSS module del componente, e undo lo toglie', async () => {
    const root = app(PLAIN);
    const jsx = 'export const App = () => <h1>Hi</h1>;\n';
    writeFileSync(join(root, 'src/App.tsx'), jsx);
    const edits = fileEdits(root);
    await edits.edit({ at: 'src/App.tsx:1:26', prop: LiveProp.Color, value: 'red', css: { color: 'red' } });

    expect(readFileSync(join(root, 'src/App.tsx'), 'utf8')).toContain('<h1 className={styles.appH1}>Hi</h1>');
    expect(readFileSync(join(root, 'src/App.module.css'), 'utf8')).toBe('.appH1 {\n  color: red;\n}\n');
    await edits.undo();
    expect(readFileSync(join(root, 'src/App.tsx'), 'utf8')).toBe(jsx);
    expect(existsSync(join(root, 'src/App.module.css'))).toBe(false);
  });
});
