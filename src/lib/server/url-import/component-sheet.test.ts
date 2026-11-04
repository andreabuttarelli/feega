import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { PlanItem } from '$lib/canvas/figma/figma-doc';
import type { RestNode } from '$lib/server/figma/rest-message';
import { compBox } from '$lib/motion/comp-frame';
import { SET_GAP_PX, addSetVariant } from '$lib/motion/component-set';
import type { PageOutline } from './page-outline';
import type { PageTree } from './page-tree';
import { parseMotionDoc } from '@feega/motion-core/motion/doc';
import { FULL_SHAPE, urlPlan } from './url-doc';

const read = <T>(path: string) => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8')) as T;

function planOf(name: string) {
  const tree = { ...read<PageTree>(`./fixtures/${name}.json`), outline: read<PageOutline>(`./fixtures/outlines/${name}.json`) };
  let n = 0;
  return urlPlan(tree, () => `id${++n}`, undefined, {}, FULL_SHAPE)!;
}

const mainsIn = (set: PlanItem) => Object.entries(set.doc.comps).filter(([, c]) => c.component);

const ownMainsIn = (made: ReturnType<typeof planOf>, at: number) => mainsIn(made.sets[at]).filter(([id]) => made.setHomes[at]?.[id] === undefined);

describe('each main or set gets its own frame, sized to its content', () => {
  it.each(['linear', 'vercel'])('%s: no Components frame sits beside the page any more', (name) => {
    expect(planOf(name).plan.items.some((item) => item.name === 'Components')).toBe(false);
  });

  it.each(['linear', 'vercel'])('%s: every main lands inside its own set frame', (name) => {
    const made = planOf(name);
    for (const [at, set] of made.sets.entries()) {
      for (const [, comp] of ownMainsIn(made, at)) {
        const box = compBox(comp, set.doc)!;
        expect(box.left).toBeGreaterThanOrEqual(0);
        expect(box.top).toBeGreaterThanOrEqual(0);
        expect(box.right).toBeLessThanOrEqual(set.doc.width + 1);
        expect(box.bottom).toBeLessThanOrEqual(set.doc.height + 1);
      }
    }
  });

  it('linear: a set frame is far smaller than the old sheet', () => {
    const { plan, sets } = planOf('linear');
    const page = plan.items[0].doc;

    expect(sets.length).toBeGreaterThan(1);
    expect(Math.max(...sets.map((s) => s.doc.width * s.doc.height))).toBeLessThan((page.width * page.height) / 4);
  });

  it('linear: variants of one set share one frame and every page main has a home, unless its set was left out', () => {
    const made = planOf('linear');
    const { plan, sets, homes } = made;
    const setNames = sets.map((_, at) => new Set(ownMainsIn(made, at).map(([, c]) => c.component!.set ?? c.component!.name)));
    const leftOut = new Set(plan.skipped.map((s) => s.split(':')[0]));
    const pageMains = plan.items.flatMap((item) => Object.entries(item.doc.comps).filter(([, c]) => c.component && !leftOut.has(c.component.set ?? c.component.name)).map(([id]) => id));

    expect(setNames.every((names) => names.size === 1)).toBe(true);
    expect(new Set(Object.values(homes).flatMap((h) => Object.keys(h)))).toEqual(new Set(pageMains));
  });

  it('linear: set frames do not overlap on the Components page', () => {
    const boxes = planOf('linear').sets.map((s) => ({ l: s.centre.x - s.size.width / 2, t: s.centre.y - s.size.height / 2, r: s.centre.x + s.size.width / 2, b: s.centre.y + s.size.height / 2 }));
    const overlaps = boxes.some((a, i) => boxes.some((b, j) => i < j && a.l < b.r && b.l < a.r && a.t < b.b && b.t < a.b));

    expect(overlaps).toBe(false);
  });
});

describe('a variant added to an imported set keeps its distance', () => {
  it('linear: every set grown with + still has a gap between all its mains', () => {
    let n = 0;
    for (const set of planOf('linear').sets) {
      const grown = addSetVariant(set.doc, () => `v${++n}`);
      if (!grown.ok) {
        continue;
      }
      const boxes = grown.doc.tracks.flatMap((t) => t.clips).filter((c) => c.component === 'Precomp').map((c) => compBox(grown.doc.comps[String(c.props.comp)], grown.doc)!).sort((a, b) => a.left - b.left);
      boxes.slice(1).forEach((box, i) => expect(Math.round(box.left - boxes[i].right)).toBeGreaterThanOrEqual(SET_GAP_PX));
    }
  });
});

const solid = (r: number, g: number, b: number) => [{ type: 'SOLID', color: { r, g, b, a: 1 } }];
const label = (id: string, characters: string, x: number, y: number): RestNode => ({ id, type: 'TEXT', characters, absoluteBoundingBox: { x, y, width: 60, height: 20 }, fills: solid(0, 0, 0), style: { fontFamily: 'Inter', fontSize: 14, fontWeight: 500 } });
const button = (id: string, main: string, x: number): RestNode => ({ id, type: 'INSTANCE', name: 'Button', componentId: main, absoluteBoundingBox: { x, y: 140, width: 100, height: 40 }, fills: solid(0.1, 0.3, 0.9), cornerRadius: 6, children: [label(`${id}t`, 'Go', x + 20, 150)] });
const card = (id: string, x: number): RestNode => ({ id, type: 'INSTANCE', name: 'Card', componentId: 'k1', absoluteBoundingBox: { x, y: 40, width: 200, height: 160 }, fills: solid(0.9, 0.9, 0.9), cornerRadius: 8, children: [label(`${id}t`, 'Title', x + 10, 50), button(`${id}b`, 'k1b', x + 10)] });
const nested = (): PageTree => ({ title: 'Nested', url: 'https://example.com', width: 600, height: 240, truncated: false, root: { id: 'root', type: 'FRAME', absoluteBoundingBox: { x: 0, y: 0, width: 600, height: 240 }, fills: solid(1, 1, 1), children: [card('k1', 40), card('k2', 300)] } });

const nestedPlan = () => {
  let n = 0;
  return urlPlan(nested(), () => `id${++n}`, (root) => root, {}, FULL_SHAPE)!;
};

describe('a button main given hover and pressed states', () => {
  it('names its set Button, not after the id of its main', () => {
    const made = nestedPlan();

    expect(made.sets.map((s) => s.name).sort()).toEqual(['Button', 'Card']);
    expect(Object.values(made.plan.items[0].doc.comps).flatMap((c) => c.component?.set ?? [])).toEqual(['Button', 'Button', 'Button']);
  });
});

describe('a main nested in another main', () => {
  it('stays homed on its own set, so the Card set does not hold a second Button main', () => {
    const made = nestedPlan();
    const at = (name: string) => made.sets.findIndex((s) => s.name === name);

    expect([...new Set(Object.values(made.setHomes[at('Card')]))]).toEqual([at('Button')]);
    expect(made.setHomes[at('Button')]).toBeUndefined();
  });
});

const dark = (id: string, x: number, mains: RestNode[]): RestNode => ({ id, type: 'FRAME', name: 'Hero', absoluteBoundingBox: { x, y: 0, width: 300, height: 240 }, fills: solid(0.05, 0.05, 0.05), children: mains });
const pill = (id: string, x: number, colour: number): RestNode => ({ id, type: 'INSTANCE', name: 'Pill', componentId: id, absoluteBoundingBox: { x, y: 100, width: 100, height: 40 }, fills: solid(colour, colour, colour), children: [label(`${id}t`, 'Go', x + 20, 110)] });
const backdropsOf = (set: PlanItem) => set.doc.tracks.flatMap((t) => t.clips).filter((c) => c.name === 'Background');
const backdropPlan = (children: RestNode[]) => {
  let n = 0;
  return urlPlan({ title: 'Dark', url: 'https://example.com', width: 600, height: 240, truncated: false, root: { id: 'root', type: 'FRAME', absoluteBoundingBox: { x: 0, y: 0, width: 600, height: 240 }, fills: solid(1, 1, 1), children } }, () => `id${++n}`, (root) => root, {}, FULL_SHAPE)!;
};

describe('a main on the Components page', () => {
  it('keeps the dark section it was designed on as its backdrop, so a light button stays readable', () => {
    const made = backdropPlan([dark('hero', 0, [pill('p1', 40, 1)])]);
    const [backdrop] = backdropsOf(made.sets[0]);

    expect(backdrop?.props).toMatchObject({ x: 0.5, y: 0.5, width: 1, height: 1, fill: '#0d0d0d' });
    expect(made.sets[0].doc.tracks.flatMap((t) => t.clips)[0].name).toBe('Background');
  });

  it('on the page background gets that background', () => {
    const made = backdropPlan([pill('p1', 340, 0.2)]);

    expect(backdropsOf(made.sets[0])[0]?.props.fill).toBe('#ffffff');
  });

  it('in a set whose variants come from a dark and a light section, the odd one gets its own backdrop behind it', () => {
    const variant = (id: string, x: number, colour: number, style: string): RestNode => ({ ...pill(id, x, colour), name: `Pill / Style=${style}` });
    const made = backdropPlan([dark('hero', 0, [variant('p1', 40, 1, 'Light')]), variant('p2', 340, 0.2, 'Dark')]);

    expect(made.sets).toHaveLength(1);
    const [whole, odd] = backdropsOf(made.sets[0]);
    expect([whole.props.fill, whole.props.width]).toEqual(['#0d0d0d', 1]);
    expect(odd.props.fill).toBe('#ffffff');
    expect(Number(odd.props.width)).toBeLessThan(0.6);
  });
});

const farButton = (id: string, x: number, y: number): RestNode => ({ ...button(id, 'kb', x), absoluteBoundingBox: { x, y, width: 100, height: 40 }, children: [label(`${id}t`, 'Go', x + 20, y + 10)] });
const farCard = (id: string, x: number, y: number): RestNode => ({ id, type: 'INSTANCE', name: 'Card', componentId: 'kc', absoluteBoundingBox: { x, y, width: 200, height: 160 }, fills: solid(0.9, 0.9, 0.9), cornerRadius: 8, children: [label(`${id}t`, 'Title', x + 10, y + 10), farButton(`${id}b`, x + 10, y + 100)] });
const tallPage = (): PageTree => ({ title: 'Tall', url: 'https://example.com', width: 600, height: 4000, truncated: false, root: { id: 'root', type: 'FRAME', absoluteBoundingBox: { x: 0, y: 0, width: 600, height: 4000 }, fills: solid(1, 1, 1), children: [farButton('kb', 40, 40), farCard('kc', 40, 3600), farCard('c2', 300, 3600)] } });

const tallPlan = () => {
  let n = 0;
  return urlPlan(tallPage(), () => `id${++n}`, (root) => root, {}, FULL_SHAPE)!;
};

describe('a main holding an instance of a main far up the page', () => {
  it.each(['linear', 'stripe', 'vercel'])('%s: every frame of the import is a doc the editor accepts, and no set is left out', (name) => {
    const made = planOf(name);
    const refused = [...made.plan.items, ...made.sets].flatMap((item) => {
      const verdict = parseMotionDoc(item.doc);
      return verdict.ok ? [] : [`${item.name}: ${verdict.error}`];
    });

    expect(refused).toEqual([]);
    expect(made.plan.skipped.filter((s) => s.includes('component set left out'))).toEqual([]);
  });

  it('lands on its set as a doc the editor accepts', () => {
    const made = tallPlan();

    expect(made.sets.map((s) => s.name).sort()).toEqual(['Button', 'Card']);
    expect(made.sets.map((s) => parseMotionDoc(s.doc)).map((v) => (v.ok ? 'ok' : v.error))).toEqual(['ok', 'ok']);
  });

  it('keeps the button inside the card on the Card set', () => {
    const made = tallPlan();
    const set = made.sets.find((s) => s.name === 'Card')!;
    const [, card] = mainsIn(set).find(([, c]) => c.component!.name === 'Card')!;
    const cardBox = compBox(card, set.doc)!;
    const inner = card.tracks.flatMap((t) => t.clips).find((c) => c.component === 'Precomp')!;
    const own = compBox(set.doc.comps[String(inner.props.comp)], set.doc)!;
    const [dx, dy] = [Number(inner.transform?.x ?? 0) * set.doc.width, Number(inner.transform?.y ?? 0) * set.doc.height];

    expect(own.left + dx).toBeGreaterThanOrEqual(cardBox.left - 1);
    expect(own.top + dy).toBeGreaterThanOrEqual(cardBox.top - 1);
    expect(own.right + dx).toBeLessThanOrEqual(cardBox.right + 1);
    expect(own.bottom + dy).toBeLessThanOrEqual(cardBox.bottom + 1);
  });
});

