import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { MotionClip } from '@feega/motion-core/motion/doc';
import type { PageTree } from './page-tree';
import type { PageOutline } from './page-outline';
import { FULL_SHAPE, PLAIN_SHAPE, Sectioning, urlPlan } from './url-doc';

const FIXTURES = ['linear', 'stripe', 'vercel'];

const treeOf = (name: string) => JSON.parse(readFileSync(new URL(`./fixtures/${name}.json`, import.meta.url), 'utf8')) as PageTree;

const clipsOf = (plan: NonNullable<ReturnType<typeof urlPlan>>) => {
  const doc = plan.plan.items[0].doc;
  return [...doc.tracks, ...Object.values(doc.comps).flatMap((c) => c.tracks)].flatMap((t) => t.clips) as MotionClip[];
};

const outlined = (name: string): PageTree => ({ ...treeOf(name), outline: JSON.parse(readFileSync(new URL(`./fixtures/outlines/${name}.json`, import.meta.url), 'utf8')) as PageOutline });

const topNames = (plan: NonNullable<ReturnType<typeof urlPlan>>) => {
  const clips = plan.plan.items[0].doc.tracks.flatMap((t) => t.clips);
  const page = clips.find((c) => !c.parent && c.autoLayout)?.id ?? null;
  return clips.filter((c) => c.parent === page && c.id !== page && (c.props.comp || c.autoLayout)).map((c) => c.name);
};

let counter = 0;
const newId = () => `id${++counter}`;

describe('urlPlan', () => {
  it.each([
    ['stripe', ['Nav', 'Hero', 'Features', 'Section 4', 'Stats']],
    ['linear', ['Nav', 'Hero', 'Logos', 'Features', 'Integrations', 'Features 2']],
    ['vercel', ['Nav', 'Hero', 'Features', 'News']]
  ])('con le sezioni, i figli del frame di %s sono le sezioni con nome', (name, names) => {
    expect(topNames(urlPlan(outlined(name), newId, undefined, {}, FULL_SHAPE)!)).toEqual(names);
  });

  it.each(FIXTURES)('il pannello livelli di %s mostra il nome della sezione, non "Group N"', (name) => {
    const doc = urlPlan(outlined(name), newId, undefined, {}, FULL_SHAPE)!.plan.items[0].doc;
    const sections = doc.tracks.flatMap((t) => t.clips.filter((c) => c.props.comp));

    expect(sections.map((c) => doc.comps[String(c.props.comp)].name)).toEqual(sections.map((c) => c.name));
  });

  it.each(FIXTURES)('senza sezioni %s resta l\'albero di prima', (name) => {
    const names = topNames(urlPlan(outlined(name), newId, undefined, {}, PLAIN_SHAPE)!);

    expect(names).not.toContain('Hero');
  });

  it.each(FIXTURES)('le sezioni non cambiano il testo che %s mostra', (name) => {
    const texts = (sectioning: Sectioning) => clipsOf(urlPlan(outlined(name), newId, (root) => root, {}, { sectioning })!).flatMap((c) => (typeof c.props.text === 'string' ? [c.props.text] : [])).sort();

    expect(texts(Sectioning.On)).toEqual(texts(Sectioning.Off));
  });

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

  it('card ripetute diventano un main e istanze collegate, col testo diverso come override', () => {
    const black = { r: 0, g: 0, b: 0, a: 1 };
    const card = (n: number, title: string): NonNullable<PageTree['root']['children']>[number] => ({
      id: `c${n}`,
      type: 'FRAME',
      name: 'article',
      absoluteBoundingBox: { x: 40 + n * 240, y: 40, width: 200, height: 120 },
      fills: [{ type: 'SOLID', color: { r: 0.9, g: 0.9, b: 0.9, a: 1 } }],
      cornerRadius: 8,
      children: [
        { id: `t${n}`, type: 'TEXT', characters: title, absoluteBoundingBox: { x: 56 + n * 240, y: 56, width: 120, height: 24 }, fills: [{ type: 'SOLID', color: black }], style: { fontFamily: 'Inter', fontSize: 20, fontWeight: 600 } },
        { id: `s${n}`, type: 'TEXT', characters: 'Learn more', absoluteBoundingBox: { x: 56 + n * 240, y: 100, width: 90, height: 20 }, fills: [{ type: 'SOLID', color: black }], style: { fontFamily: 'Inter', fontSize: 14, fontWeight: 400 } }
      ]
    });
    const tree: PageTree = { title: 'Cards', url: 'https://example.com', width: 800, height: 200, truncated: false, root: { id: '1', type: 'FRAME', absoluteBoundingBox: { x: 0, y: 0, width: 800, height: 200 }, fills: [{ type: 'SOLID', color: { r: 1, g: 1, b: 1, a: 1 } }], children: [card(0, 'Fast'), card(1, 'Secure'), card(2, 'Open')] } };

    const made = urlPlan(tree, newId)!;
    const doc = made.plan.items[0].doc;
    const mains = Object.entries(doc.comps).filter(([, c]) => c.component);
    const instances = doc.tracks.flatMap((t) => t.clips).filter((c) => c.props.comp === mains[0]?.[0]);
    const overridden = instances.flatMap((c) => Object.values((c.props.overrides as Record<string, { text?: string }>) ?? {})).map((o) => o.text);

    expect(mains).toHaveLength(1);
    expect(mains[0][1].component?.name).toBe('Card');
    expect(instances).toHaveLength(3);
    expect(overridden.sort()).toEqual(['Open', 'Secure']);
    expect(made.components).toEqual({ components: 1, instances: 2 });
  });

  it.each(FIXTURES)('le strutture ripetute di %s diventano componenti con istanze', (name) => {
    const made = urlPlan(treeOf(name), newId)!;

    expect(made.components.components).toBeGreaterThan(0);
    expect(made.components.instances).toBeGreaterThan(0);
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
