import { describe, expect, it } from 'vitest';
import { applyEdits, editsOf, unifiedDiff, type SourceEdit } from './write-back';
import type { MotionDoc } from '@feega/motion-core/motion/doc';

const PAGE = `<script>\n  import { m } from '$lib/paraglide/messages';\n</script>\n\n<section class="hero">\n  <h1 class="text-primary">Ciao mondo</h1>\n  <p>{m.home_intro()}</p>\n  <div class="row" style="opacity: 1">x</div>\n</section>\n`;
const MESSAGES = `{\n  "home_title": "Ciao",\n  "nav_intro": "Benvenuta su traidue",\n  "home_intro": "Benvenuta su traidue"\n}\n`;
const SETTINGS = JSON.stringify({ languageTags: ['it', 'en'], 'plugin.inlang.messageFormat': { pathPattern: './messages/{languageTag}.json' } });

const FILES: Record<string, string> = { 'src/routes/+page.svelte': PAGE, 'messages/it.json': MESSAGES, 'messages/en.json': '{\n  "home_intro": "Welcome"\n}\n', 'project.inlang/settings.json': SETTINGS };
const read = async (path: string) => FILES[path] ?? null;

const edit = (line: number, column: number, look: SourceEdit['look'], was: SourceEdit['was']): SourceEdit => ({ at: { file: 'src/routes/+page.svelte', line, column }, look, was });

describe('write-back', () => {
  it('riscrive un testo letterale nel suo elemento', async () => {
    const done = await applyEdits([edit(6, 2, { text: 'Ciao traidue' }, { text: 'Ciao mondo' })], read);
    expect(done.files[0].after).toContain('<h1 class="text-primary">Ciao traidue</h1>');
    expect(done.skipped).toEqual([]);
  });

  it('un testo che viene da un messaggio cambia il catalogo della lingua mostrata', async () => {
    const done = await applyEdits([edit(7, 2, { text: 'Benvenut* su traidue' }, { text: 'Benvenuta su traidue' })], read);
    expect(done.files.map((f) => f.path)).toEqual(['messages/it.json']);
    expect(done.files[0].after).toBe(MESSAGES.replace('"home_intro": "Benvenuta su traidue"', '"home_intro": "Benvenut* su traidue"'));
  });

  it('uno stile cambiato diventa style inline, unito a quello che c’era', async () => {
    const done = await applyEdits([edit(6, 2, { color: '#ff0000' }, { color: '#111111' }), edit(8, 2, { gap: 24 }, { gap: 8 })], read);
    const after = done.files[0].after;
    expect(after).toContain('<h1 class="text-primary" style="color: #ff0000">');
    expect(after).toContain('style="opacity: 1; gap: 24px"');
  });

  it('una posizione che non punta a un tag viene saltata, non indovinata', async () => {
    const done = await applyEdits([edit(2, 0, { text: 'x' }, { text: 'y' })], read);
    expect(done.files).toEqual([]);
    expect(done.skipped[0]).toMatch(/\+page\.svelte:2/);
  });

  it('il diff si applica con git apply', () => {
    const diff = unifiedDiff('a.svelte', 'a\nb\nc\n', 'a\nB\nc\n');
    expect(diff).toBe('--- a/a.svelte\n+++ b/a.svelte\n@@ -1,3 +1,3 @@\n a\n-b\n+B\n c\n');
  });

  it('due modifiche lontane fanno due blocchi, e le righe in mezzo non compaiono', () => {
    const before = Array.from({ length: 30 }, (_, i) => `line ${i + 1}`).join('\n') + '\n';
    const after = before.replace('line 3\n', 'LINE 3\n').replace('line 25\n', 'LINE 25\nadded\n');
    expect(unifiedDiff('a.css', before, after)).toBe(
      '--- a/a.css\n+++ b/a.css\n' +
        '@@ -1,6 +1,6 @@\n line 1\n line 2\n-line 3\n+LINE 3\n line 4\n line 5\n line 6\n' +
        '@@ -22,7 +22,8 @@\n line 22\n line 23\n line 24\n-line 25\n+LINE 25\n+added\n line 26\n line 27\n line 28\n'
    );
  });

  it('legge le modifiche dai clip che portano una sorgente', () => {
    const clip = (id: string, text: string, was: string) => ({ id, component: 'Text', props: { text }, source: { at: 'src/x.svelte:3:4', was: { text: was } } });
    const doc = { width: 100, height: 100, tracks: [{ clips: [clip('a', 'new', 'old'), clip('b', 'same', 'same')] }], comps: {} } as unknown as MotionDoc;
    expect(editsOf(doc)).toEqual([{ at: { file: 'src/x.svelte', line: 3, column: 4 }, look: { text: 'new' }, was: { text: 'old' } }]);
  });

  it('un livello legato a una variabile non scrive il suo colore nel template: lo scrive il token', () => {
    const clip = { id: 'a', component: 'Text', props: { text: 'new', color: '#f0f0f0' }, bind: { color: 'app Colors/primary' }, source: { at: 'src/x.svelte:3:4', was: { text: 'old', color: '#111111' } } };
    const doc = { width: 100, height: 100, tracks: [{ clips: [clip] }], comps: {} } as unknown as MotionDoc;
    expect(editsOf(doc).map((e) => e.look)).toEqual([{ text: 'new' }]);
  });

  it('un colore scelto dal picker vive nella pila di fill del testo, e conta come colore', () => {
    const clip = { id: 'a', component: 'Text', props: { text: 't', color: '#111111', fills: [{ type: 'solid', color: '#c2185b' }] }, source: { at: 'src/x.svelte:3:4', was: { text: 't', color: '#111111' } } };
    const doc = { width: 100, height: 100, tracks: [{ clips: [clip] }], comps: {} } as unknown as MotionDoc;
    expect(editsOf(doc)[0].look).toEqual({ color: '#c2185b' });
  });

  it('una riga spostata dal preprocessore si ritrova dal tag e dalle classi, non si indovina', async () => {
    const moved = { ...edit(13, 2, { text: 'Benvenut* su traidue' }, { text: 'Benvenuta su traidue' }), spot: { tag: 'p', cls: '' } };
    const styled = { ...edit(12, 2, { color: '#ff0000' }, { color: '#111111' }), spot: { tag: 'h1', cls: 'text-primary' } };
    const lost = { ...edit(12, 2, { color: '#ff0000' }, { color: '#111111' }), spot: { tag: 'h3', cls: 'nope' } };
    const done = await applyEdits([moved, styled, lost], read);
    expect(done.files.find((f) => f.path === 'src/routes/+page.svelte')?.after).toContain('<h1 class="text-primary" style="color: #ff0000">');
    expect(done.files.find((f) => f.path === 'messages/it.json')?.after).toContain('"home_intro": "Benvenut* su traidue"');
    expect(done.skipped).toHaveLength(1);
  });

  it('una modifica sotto dark in un progetto Tailwind scrive la variante dark: e lascia intatto il chiaro', async () => {
    const page = '<div class="bg-white text-black">x</div>\n';
    const files: Record<string, string> = { 'a.svelte': page, 'package.json': '{"devDependencies":{"tailwindcss":"^4"}}' };
    const dark = { at: { file: 'a.svelte', line: 1, column: 0 }, look: { fill: '#101010' }, was: { fill: '#ffffff' }, cond: 'dark@1280' };
    const done = await applyEdits([dark], async (path) => files[path] ?? null);
    expect(done.files[0].after).toBe('<div class="bg-white text-black dark:bg-[#101010]">x</div>\n');
    expect(done.files[0].after).not.toContain('style=');
  });

  it('una seconda modifica dark sostituisce la precedente invece di impilarla', async () => {
    const files: Record<string, string> = { 'a.svelte': '<div class="bg-white dark:bg-zinc-900">x</div>\n', 'package.json': '{"dependencies":{"tailwindcss":"3"}}' };
    const dark = { at: { file: 'a.svelte', line: 1, column: 0 }, look: { fill: '#101010' }, was: { fill: '#18181b' }, cond: 'dark@1280' };
    const done = await applyEdits([dark], async (path) => files[path] ?? null);
    expect(done.files[0].after).toBe('<div class="bg-white dark:bg-[#101010]">x</div>\n');
  });

  it('una modifica sotto il chiaro, in Tailwind, scrive la classe base e non tocca il dark:', async () => {
    const files: Record<string, string> = { 'a.svelte': '<div class="bg-white dark:bg-zinc-900">x</div>\n', 'package.json': '{"dependencies":{"tailwindcss":"3"}}' };
    const light = { at: { file: 'a.svelte', line: 1, column: 0 }, look: { fill: '#fafafa' }, was: { fill: '#ffffff' } };
    const done = await applyEdits([light], async (path) => files[path] ?? null);
    expect(done.files[0].after).toBe('<div class="dark:bg-zinc-900 bg-[#fafafa]">x</div>\n');
  });

  it('dark senza Tailwind non si scrive: si salta e si dice perché, mai uno style inline che schiaccia il chiaro', async () => {
    const files: Record<string, string> = { 'a.svelte': '<div class="card">x</div>\n' };
    const dark = { at: { file: 'a.svelte', line: 1, column: 0 }, look: { fill: '#101010' }, was: { fill: '#ffffff' }, cond: 'dark@1280' };
    const done = await applyEdits([dark], async (path) => files[path] ?? null);
    expect(done.files).toEqual([]);
    expect(done.skipped[0]).toMatch(/a\.svelte:1.*dark/);
  });

  it('una larghezza diversa dal desktop non si scrive: sarebbe una regola per tutte le larghezze', async () => {
    const files: Record<string, string> = { 'a.svelte': '<div class="bg-white">x</div>\n', 'package.json': '{"dependencies":{"tailwindcss":"3"}}' };
    const phone = { at: { file: 'a.svelte', line: 1, column: 0 }, look: { fill: '#101010' }, was: { fill: '#ffffff' }, cond: 'light@390' };
    const done = await applyEdits([phone], async (path) => files[path] ?? null);
    expect(done.files).toEqual([]);
    expect(done.skipped[0]).toMatch(/390/);
  });

  it('la stessa riga vista in chiaro e in dark dà due modifiche, non una', () => {
    const clip = (id: string, color: string, cond?: string) => ({ id, component: 'Rectangle', props: { fills: [{ type: 'solid', color }] }, source: { at: 'src/x.svelte:3:4', ...(cond ? { cond } : {}), was: { fill: '#ffffff' } } });
    const doc = { width: 100, height: 100, tracks: [{ clips: [clip('a', '#fafafa'), clip('b', '#101010', 'dark@1280')] }], comps: {} } as unknown as MotionDoc;
    expect(editsOf(doc).map((e) => [e.cond ?? null, e.look])).toEqual([[null, { fill: '#fafafa' }], ['dark@1280', { fill: '#101010' }]]);
  });
});
