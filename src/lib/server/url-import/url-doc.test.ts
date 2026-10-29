import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { MotionClip } from '@feega/motion-core/motion/doc';
import type { PageTree } from './page-tree';
import { urlPlan } from './url-doc';

const FIXTURES = ['linear', 'stripe', 'vercel'];

const treeOf = (name: string) => JSON.parse(readFileSync(new URL(`./fixtures/${name}.json`, import.meta.url), 'utf8')) as PageTree;

const clipsOf = (plan: NonNullable<ReturnType<typeof urlPlan>>) => {
  const doc = plan.plan.items[0].doc;
  return [...doc.tracks, ...Object.values(doc.comps).flatMap((c) => c.tracks)].flatMap((t) => t.clips) as MotionClip[];
};

let counter = 0;
const newId = () => `id${++counter}`;

describe('urlPlan', () => {
  it.each(FIXTURES)('una pagina reale %s diventa un solo frame col titolo della pagina', (name) => {
    const tree = treeOf(name);
    const made = urlPlan(tree, newId);

    expect(made?.plan.items).toHaveLength(1);
    expect(made?.plan.items[0].name).toBe(tree.title.slice(0, 80));
    expect(made?.plan.items[0].size.width).toBe(tree.width);
  });

  it.each(FIXTURES)('il testo di %s resta testo modificabile, non un\'immagine', (name) => {
    const clips = clipsOf(urlPlan(treeOf(name), newId)!);
    const texts = clips.filter((c) => typeof c.props.text === 'string' && (c.props.text as string).trim());

    expect(texts.length).toBeGreaterThan(10);
  });

  it.each(FIXTURES)('i contenitori flex di %s arrivano in auto layout', (name) => {
    const doc = urlPlan(treeOf(name), newId)!.plan.items[0].doc;
    const stacked = JSON.stringify(doc).match(/"autoLayout":\{/g) ?? [];

    expect(stacked.length).toBeGreaterThan(0);
  });

  it('le immagini diventano riferimenti da importare, con un url per chiave', () => {
    const made = urlPlan(treeOf('stripe'), newId)!;
    const hashes = new Set(made.plan.items[0].images.map((i) => i.hash));

    expect([...hashes].every((h) => made.images[h]?.startsWith('http'))).toBe(true);
  });

  it('un font della pagina che Google Fonts non ha diventa il ripiego, non un nome inventato', () => {
    const tree: PageTree = {
      title: 'Fonts',
      url: 'https://example.com',
      width: 400,
      height: 200,
      truncated: false,
      root: {
        id: '1',
        type: 'FRAME',
        absoluteBoundingBox: { x: 0, y: 0, width: 400, height: 200 },
        children: [{ id: '2', type: 'TEXT', characters: 'Hello', absoluteBoundingBox: { x: 10, y: 10, width: 100, height: 20 }, fills: [{ type: 'SOLID', color: { r: 0, g: 0, b: 0, a: 1 } }], style: { fontFamily: 'SöhneSecret', fontSize: 16, fontWeight: 400 } }]
      }
    };

    const text = JSON.stringify(urlPlan(tree, newId)!.plan.items[0].doc);

    expect(text).not.toContain('SöhneSecret');
  });

  it('un paragrafo che nella pagina va a capo resta largo come nella pagina', () => {
    const tree: PageTree = {
      title: 'Wrap',
      url: 'https://example.com',
      width: 800,
      height: 400,
      truncated: false,
      root: {
        id: '1',
        type: 'FRAME',
        absoluteBoundingBox: { x: 0, y: 0, width: 800, height: 400 },
        children: [{ id: '2', type: 'TEXT', textAutoResize: 'HEIGHT', characters: 'A long paragraph that wraps over three lines in the page', absoluteBoundingBox: { x: 10, y: 10, width: 200, height: 72 }, fills: [{ type: 'SOLID', color: { r: 0, g: 0, b: 0, a: 1 } }], style: { fontFamily: 'Inter', fontSize: 20, fontWeight: 400 } }]
      }
    };

    const clip = clipsOf(urlPlan(tree, newId)!).find((c) => c.props.text);

    expect(clip?.props.sizing).toBe('auto-height');
  });
});
