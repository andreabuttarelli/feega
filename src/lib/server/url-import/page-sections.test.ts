import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { OutlineBlock, PageOutline } from './page-outline';
import { sectionsOf } from './page-sections';

const outlineOf = (name: string) => JSON.parse(readFileSync(new URL(`./fixtures/outlines/${name}.json`, import.meta.url), 'utf8')) as PageOutline;

const page = (children: OutlineBlock[], height = 3000): PageOutline => ({ width: 1280, height, root: { tag: 'body', box: { y: 0, height, width: 1280 }, children } });

const block = (tag: string, y: number, height: number, more: Partial<OutlineBlock> = {}): OutlineBlock => ({ tag, box: { y, height, width: 1280 }, ...more });

describe('sectionsOf', () => {
  it.each([
    ['stripe', ['Nav', 'Hero', 'Features', 'Section 4', 'Stats', 'Testimonials', 'Section 7', 'News', 'Section 9', 'Footer'], [0, 76, 693, 2906, 3466, 4436, 9019, 11442, 13309, 13689]],
    ['linear', ['Nav', 'Hero', 'Logos', 'AI', 'Integrations', 'Section 6', 'AI 2', 'Section 8', 'News', 'Customers', 'CTA', 'Footer'], [0, 73, 1298, 1390, 2095, 3491, 4730, 5972, 7202, 7781, 8505, 8901]],
    ['vercel', ['Nav', 'Hero', 'AI', 'News', 'AI 2', 'Footer'], [0, 64, 800, 3210, 4136, 4824]]
  ])('%s si divide nelle sezioni della pagina, coi loro nomi', (name, names, tops) => {
    const found = sectionsOf(outlineOf(name));

    expect(found.map((s) => s.name)).toEqual(names);
    expect(found.map((s) => s.top)).toEqual(tops);
  });

  it.each(['stripe', 'linear', 'vercel'])('le sezioni di %s coprono la pagina senza buchi né sovrapposizioni', (name) => {
    const outline = outlineOf(name);
    const found = sectionsOf(outline);

    expect(found[0].top).toBe(0);
    expect(found.at(-1)!.bottom).toBe(outline.height);
    found.slice(1).forEach((s, i) => expect(s.top).toBe(found[i].bottom));
  });

  it('i ruoli ARIA valgono quanto i tag', () => {
    const found = sectionsOf(page([block('div', 0, 80, { role: 'banner' }), block('div', 80, 1000, { h1: true, heading: 'Ship faster' }), block('div', 1080, 1920, { role: 'contentinfo' })]));

    expect(found.map((s) => s.name)).toEqual(['Nav', 'Hero', 'Footer']);
  });

  it('un blocco senza titolo, sullo stesso sfondo e vicino, resta nella sezione sopra', () => {
    const found = sectionsOf(page([block('div', 0, 1000, { h1: true, heading: 'Hello' }), block('div', 1100, 400, { heading: 'Company', background: 'rgb(0, 0, 0)' }), block('div', 1540, 400, { background: 'rgb(0, 0, 0)' }), block('div', 2000, 1000)]));

    expect(found.map((s) => [s.name, s.top])).toEqual([['Hero', 0], ['Section 2', 1000], ['Section 3', 1940]]);
  });

  it('un cambio di sfondo apre una sezione nuova anche senza titolo', () => {
    const found = sectionsOf(page([block('div', 0, 1000, { h1: true, heading: 'Hello' }), block('div', 1000, 500, { background: 'rgb(13, 23, 56)' }), block('div', 1500, 1500)]));

    expect(found).toHaveLength(3);
  });

  it('un vuoto grande fra due blocchi apre una sezione nuova', () => {
    const found = sectionsOf(page([block('div', 0, 1000, { h1: true, heading: 'Hello' }), block('div', 1300, 500)]));

    expect(found.map((s) => s.top)).toEqual([0, 1000]);
  });

  it('i nomi ripetuti diventano unici', () => {
    const found = sectionsOf(page([block('section', 0, 1000, { heading: 'Our features' }), block('section', 1000, 1000, { heading: 'More features' }), block('section', 2000, 1000)]));

    expect(found.map((s) => s.name)).toEqual(['Features', 'Features 2', 'Section 3']);
  });

  it.each([
    ['How it works', 'How it works'],
    ['Use cases for every team', 'Use cases'],
    ['Enterprise-grade security', 'Security'],
    ['Meet the team', 'Team'],
    ['From the blog', 'News'],
    ['Our customers', 'Customers'],
    ['Connect your integrations', 'Integrations']
  ])('il titolo "%s" dà il nome %s', (heading, name) => {
    expect(sectionsOf(page([block('section', 0, 3000, { heading })]))[0].name).toBe(name);
  });

  it('una pagina senza blocchi riconoscibili resta una sezione sola', () => {
    expect(sectionsOf(page([]))).toEqual([{ name: 'Section 1', top: 0, bottom: 3000 }]);
  });
});
