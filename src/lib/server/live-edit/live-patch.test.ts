import { describe, expect, it } from 'vitest';
import { LiveProp, Side } from '$lib/canvas/live-fields';
import { livePatch } from './live-patch';

const HERO = `'use client';

export function Hero() {
  return (
    <header className="flex flex-col gap-4">
      <h1 className="text-5xl font-semibold tracking-tight">Ship faster</h1>
      <a id="cta" className="rounded-md bg-black px-4 py-2 text-white" href="#">Get started</a>
    </header>
  );
}
`;

const ABOUT = `<div class="w-full max-w-3xl mx-auto px-4 sm:px-6 lg:px-12 py-8 sm:py-12">
	<h1 class="text-2xl sm:text-3xl lg:text-4xl font-heading font-semibold tracking-tight text-primary mb-4">{m.about_page_title()}</h1>
</div>
`;

const MESSAGES = `{
  "about_page_title": "Chi Siamo",
  "about_mission_title": "Missione"
}
`;

const INLANG = JSON.stringify({ languageTags: ['it'], 'plugin.inlang.messageFormat': { pathPattern: './messages/{languageTag}.json' } });

const filesOf = (files: Record<string, string>) => async (path: string) => files[path] ?? null;

const H1 = { file: 'app/Hero.tsx', line: 6, col: 7 };
const CTA = { file: 'app/Hero.tsx', line: 7, col: 7 };
const ABOUT_H1 = { file: 'src/routes/chi-siamo/+page.svelte', line: 2, col: 2 };
const ABOUT_BOX = { file: 'src/routes/chi-siamo/+page.svelte', line: 1, col: 1 };

const changedLines = (before: string, after: string) => after.split('\n').filter((line, i) => line !== before.split('\n')[i]);

describe('livePatch', () => {
  it('cambia il testo letterale e nient altro', async () => {
    const out = await livePatch(filesOf({ 'app/Hero.tsx': HERO }), H1, { prop: LiveProp.Text, value: 'Ship today', was: 'Ship faster' });

    expect(out.files).toHaveLength(1);
    expect(changedLines(HERO, out.files[0].after)).toEqual(['      <h1 className="text-5xl font-semibold tracking-tight">Ship today</h1>']);
  });

  it('il testo da un messaggio inlang cambia il catalogo', async () => {
    const read = filesOf({ 'src/routes/chi-siamo/+page.svelte': ABOUT, 'project.inlang/settings.json': INLANG, 'messages/it.json': MESSAGES });
    const out = await livePatch(read, ABOUT_H1, { prop: LiveProp.Text, value: 'Chi siamo davvero', was: 'Chi Siamo' });

    expect(out.files.map((f) => f.path)).toEqual(['messages/it.json']);
    expect(changedLines(MESSAGES, out.files[0].after)).toEqual(['  "about_page_title": "Chi siamo davvero",']);
  });

  it('il colore del testo sostituisce solo la classe colore, al suo posto', async () => {
    const out = await livePatch(filesOf({ 'src/routes/chi-siamo/+page.svelte': ABOUT }), ABOUT_H1, { prop: LiveProp.Color, value: 'red-600' });

    expect(changedLines(ABOUT, out.files[0].after)).toEqual(['\t<h1 class="text-2xl sm:text-3xl lg:text-4xl font-heading font-semibold tracking-tight text-red-600 mb-4">{m.about_page_title()}</h1>']);
  });

  it('il colore senza classe colore si aggiunge in coda', async () => {
    const out = await livePatch(filesOf({ 'app/Hero.tsx': HERO }), H1, { prop: LiveProp.Color, value: '[#ff3b30]' });

    expect(changedLines(HERO, out.files[0].after)).toEqual(['      <h1 className="text-5xl font-semibold tracking-tight text-[#ff3b30]">Ship faster</h1>']);
  });

  it('il fondo cambia bg-*, il testo bianco resta', async () => {
    const out = await livePatch(filesOf({ 'app/Hero.tsx': HERO }), CTA, { prop: LiveProp.Fill, value: 'blue-600' });

    expect(changedLines(HERO, out.files[0].after)).toEqual(['      <a id="cta" className="rounded-md bg-blue-600 px-4 py-2 text-white" href="#">Get started</a>']);
  });

  it('la dimensione del testo non tocca le varianti responsive', async () => {
    const out = await livePatch(filesOf({ 'src/routes/chi-siamo/+page.svelte': ABOUT }), ABOUT_H1, { prop: LiveProp.FontSize, value: '5xl' });

    expect(changedLines(ABOUT, out.files[0].after)).toEqual(['\t<h1 class="text-5xl sm:text-3xl lg:text-4xl font-heading font-semibold tracking-tight text-primary mb-4">{m.about_page_title()}</h1>']);
  });

  it('il peso cambia font-semibold e lascia font-heading', async () => {
    const out = await livePatch(filesOf({ 'src/routes/chi-siamo/+page.svelte': ABOUT }), ABOUT_H1, { prop: LiveProp.FontWeight, value: 'bold' });

    expect(out.files[0].after).toContain('font-heading font-bold tracking-tight');
  });

  it('il padding orizzontale cambia px-4 e lascia sm:px-6, py-8', async () => {
    const out = await livePatch(filesOf({ 'src/routes/chi-siamo/+page.svelte': ABOUT }), ABOUT_BOX, { prop: LiveProp.Padding, side: Side.X, value: '8' });

    expect(changedLines(ABOUT, out.files[0].after)).toEqual(['<div class="w-full max-w-3xl mx-auto px-8 sm:px-6 lg:px-12 py-8 sm:py-12">']);
  });

  it('il margine sotto cambia mb-4', async () => {
    const out = await livePatch(filesOf({ 'src/routes/chi-siamo/+page.svelte': ABOUT }), ABOUT_H1, { prop: LiveProp.Margin, side: Side.Bottom, value: '[18px]' });

    expect(out.files[0].after).toContain('text-primary mb-[18px]">');
  });

  it('il gap cambia gap-4', async () => {
    const out = await livePatch(filesOf({ 'app/Hero.tsx': HERO }), { file: 'app/Hero.tsx', line: 5, col: 5 }, { prop: LiveProp.Gap, value: '8' });

    expect(changedLines(HERO, out.files[0].after)).toEqual(['    <header className="flex flex-col gap-8">']);
  });

  it('il raggio cambia rounded-md', async () => {
    const out = await livePatch(filesOf({ 'app/Hero.tsx': HERO }), CTA, { prop: LiveProp.Radius, value: 'full' });

    expect(out.files[0].after).toContain('className="rounded-full bg-black');
  });

  it('una classe calcolata non si riscrive', async () => {
    const dynamic = `<div>\n  <p className={cn('p-4', open && 'p-8')}>x</p>\n</div>\n`;
    const out = await livePatch(filesOf({ 'a.tsx': dynamic }), { file: 'a.tsx', line: 2, col: 3 }, { prop: LiveProp.Padding, value: '2' });

    expect(out.files).toEqual([]);
    expect(out.skipped[0]).toMatch(/not a literal/);
  });

  it('un elemento che non sta più a file:line non si tocca', async () => {
    const out = await livePatch(filesOf({ 'app/Hero.tsx': HERO }), { file: 'app/Hero.tsx', line: 2, col: 1 }, { prop: LiveProp.Color, value: 'red-600' });

    expect(out.files).toEqual([]);
    expect(out.skipped[0]).toMatch(/not where/);
  });

  it('a 1440 di larghezza cambia la classe che vale lì, non quella di base che non si vede', async () => {
    const read = filesOf({ [ABOUT_H1.file]: ABOUT });

    const out = await livePatch(read, ABOUT_H1, { prop: LiveProp.FontSize, value: '[40px]', viewport: 1440 });

    expect(out.files[0].after).toContain('class="text-2xl sm:text-3xl lg:text-[40px] font-heading');
  });

  it('a 390 di larghezza cambia la classe di base', async () => {
    const read = filesOf({ [ABOUT_H1.file]: ABOUT });

    const out = await livePatch(read, ABOUT_H1, { prop: LiveProp.FontSize, value: '[40px]', viewport: 390 });

    expect(out.files[0].after).toContain('class="text-[40px] sm:text-3xl lg:text-4xl font-heading');
  });

  it('a 700 di larghezza il padding orizzontale che vale è quello di sm', async () => {
    const read = filesOf({ [ABOUT_BOX.file]: ABOUT });

    const out = await livePatch(read, ABOUT_BOX, { prop: LiveProp.Padding, side: Side.X, value: '8', viewport: 700 });

    expect(out.files[0].after).toContain('px-4 sm:px-8 lg:px-12 py-8');
  });
});
