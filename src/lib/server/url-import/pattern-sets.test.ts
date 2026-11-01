import { describe, expect, it } from 'vitest';
import { everyClip, type MotionDoc } from '@feega/motion-core/motion/doc';
import { ActionKind } from '@feega/motion-core/motion/prototype/model';
import type { RestNode } from '$lib/server/figma/rest-message';
import type { PageTree } from './page-tree';
import { PatternKind, type PagePattern } from './page-patterns';
import { PLAIN_SHAPE, urlPlan } from './url-doc';
import { repeatedOf } from './repeated';

let counter = 0;
const newId = () => `p${++counter}`;

const box = (x: number, y: number, width: number, height: number) => ({ x, y, width, height });
const ink = { r: 0.1, g: 0.1, b: 0.1, a: 1 };
const line = { r: 0.8, g: 0.8, b: 0.8, a: 1 };

const text = (id: string, characters: string, y: number): RestNode => ({ id, type: 'TEXT', name: 'p', characters, absoluteBoundingBox: box(20, y, 300, 20), style: { fontFamily: 'Inter', fontSize: 16, fontWeight: 400, lineHeightPx: 20 }, fills: [{ type: 'SOLID', color: ink }] });

const summary = (id: string, question: string, y: number, go: string): RestNode => ({ id, type: 'FRAME', name: 'summary', absoluteBoundingBox: box(20, y, 360, 30), fills: [], go, children: [text(`${id}-t`, question, y + 5)] });

const item = (n: number, y: number, open: boolean): RestNode => ({
  id: open ? `open-${n}` : `item-${n}`,
  type: 'FRAME',
  name: 'details',
  pattern: n,
  absoluteBoundingBox: box(20, y, 360, open ? 70 : 30),
  fills: [],
  strokes: [{ type: 'SOLID', color: line }],
  strokeWeight: 1,
  children: [summary(open ? `open-s${n}` : `s${n}`, `Question ${n}`, y, open ? 'Closed' : 'Open'), ...(open ? [text(`a${n}`, `Answer ${n}`, y + 40)] : [])]
});

const page = (children: RestNode[], patterns: PagePattern[]): PageTree => ({ title: 'FAQ', url: 'https://faq.example/', width: 400, height: 400, truncated: false, patterns, root: { id: 'root', type: 'FRAME', name: 'FAQ', absoluteBoundingBox: box(0, 0, 400, 400), fills: [{ type: 'SOLID', color: { r: 1, g: 1, b: 1, a: 1 } }], children } });

const accordion = (n: number, y: number): PagePattern => ({ ix: n, kind: PatternKind.Accordion, prop: 'State', initial: 'Closed', states: ['Closed', 'Open'], variants: [{ state: 'Open', root: item(n, y, true) }] });

const faq = () => page([item(0, 20, false), item(1, 60, false)], [accordion(0, 20), accordion(1, 60)]);

const REPEATED = (root: RestNode) => repeatedOf(root).root;

const docOf = (tree: PageTree) => urlPlan(tree, newId, REPEATED, {}, PLAIN_SHAPE)!.plan.items[0].doc;

const sets = (doc: MotionDoc) =>
  Object.values(doc.comps)
    .filter((c) => c.component?.set?.startsWith('Accordion'))
    .map((c) => [c.component!.set, c.component!.variant]);

const placedComps = (doc: MotionDoc) => new Set(everyClip(doc).map((c) => String(c.props.comp ?? '')));

describe('a dynamic part of the page becomes a component with a variant per state', () => {
  it('each accordion item is its own set, Closed as on the page and Open beside it', () => {
    expect(sets(docOf(faq()))).toEqual([
      ['Accordion 1', { State: 'Closed' }],
      ['Accordion 1', { State: 'Open' }],
      ['Accordion 2', { State: 'Closed' }],
      ['Accordion 2', { State: 'Open' }]
    ]);
  });

  it('the page shows only the state it was in: the other variants are not placed', () => {
    const doc = docOf(faq());
    const placed = placedComps(doc);
    const open = Object.entries(doc.comps).filter(([, c]) => c.component?.variant?.State === 'Open').map(([id]) => id);
    const closed = Object.entries(doc.comps).filter(([, c]) => c.component?.variant?.State === 'Closed').map(([id]) => id);

    expect(open.some((id) => placed.has(id))).toBe(false);
    expect(closed.every((id) => placed.has(id))).toBe(true);
    expect(everyClip(doc).some((c) => c.hidden && c.component === 'Precomp')).toBe(false);
  });

  it('the question leads to the other state of its own item', () => {
    const doc = docOf(faq());
    const links = Object.values(doc.comps).flatMap((c) => c.tracks.flatMap((t) => t.clips.flatMap((clip) => (clip.interactions ?? []).map((i) => [c.component?.variant?.State, i.action]))));

    expect(links).toContainEqual(['Closed', { kind: ActionKind.ChangeTo, variant: { State: 'Open' } }]);
    expect(links).toContainEqual(['Open', { kind: ActionKind.ChangeTo, variant: { State: 'Closed' } }]);
  });

  it('two items that look alike are not folded into one repeated component', () => {
    const doc = docOf(faq());

    expect(Object.values(doc.comps).filter((c) => c.component && !c.component.set?.startsWith('Accordion'))).toEqual([]);
  });

  it('a page with no dynamic parts plans as before', () => {
    const plain = page([item(0, 20, false)], []);
    const { pattern: _p, ...bare } = plain.root.children![0];
    const before = docOf({ ...plain, root: { ...plain.root, children: [{ ...bare, children: bare.children!.map(({ go: _g, ...c }) => c) }] } });

    expect(Object.values(before.comps).some((c) => c.component)).toBe(false);
  });
});
