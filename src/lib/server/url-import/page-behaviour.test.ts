import { describe, expect, it } from 'vitest';
import { everyClip } from '@feega/motion-core/motion/doc';
import { Ease } from '@feega/motion-core/motion/design';
import { ElementState, type StateRow } from '@feega/motion-core/motion/states/model';
import type { RestNode } from '$lib/server/figma/rest-message';
import type { PageTree } from './page-tree';
import { FULL_SHAPE, PLAIN_SHAPE, urlPlan } from './url-doc';

let counter = 0;
const newId = () => `b${++counter}`;

const ink = { r: 0.1, g: 0.1, b: 0.1, a: 1 };

const box = (x: number, y: number, width: number, height: number) => ({ x, y, width, height });

const text = (id: string, characters: string, y: number): RestNode => ({ id, type: 'TEXT', name: 'p', characters, absoluteBoundingBox: box(20, y, 200, 20), style: { fontFamily: 'Inter', fontSize: 16, fontWeight: 400, lineHeightPx: 20 }, fills: [{ type: 'SOLID', color: ink }] });

const button = (behaviour: RestNode['behaviour']): RestNode => ({
  id: 'button',
  type: 'FRAME',
  name: 'Buy',
  absoluteBoundingBox: box(20, 20, 120, 40),
  fills: [{ type: 'SOLID', color: { r: 0, g: 0.4, b: 1, a: 1 } }],
  behaviour,
  children: [text('label', 'Buy now', 30)]
});

const page = (children: RestNode[]): PageTree => ({ title: 'Shop', url: 'https://shop.example/', width: 400, height: 300, truncated: false, root: { id: 'root', type: 'FRAME', name: 'Shop', absoluteBoundingBox: box(0, 0, 400, 300), fills: [{ type: 'SOLID', color: { r: 1, g: 1, b: 1, a: 1 } }], children } });

const clipsOfPlan = (tree: PageTree) => everyClip(urlPlan(tree, newId, (root) => root, {}, PLAIN_SHAPE)!.plan.items[0].doc);

describe('a page node carries its behaviour into the clip it becomes', () => {
  it('a hover read from the page lands on the layer as an element state', () => {
    const hover: StateRow = { state: ElementState.Hover, overrides: { fill: '#003399' }, transition: { easing: Ease.Standard, durationMs: 150 } };
    const clips = clipsOfPlan(page([button({ states: [hover] })]));

    expect(clips.filter((c) => c.states?.length).map((c) => c.states)).toEqual([[hover]]);
  });

  it('a node without behaviour gives a clip without states or interactions', () => {
    const clips = clipsOfPlan(page([button(undefined)]));

    expect(clips.some((c) => c.states || c.interactions)).toBe(false);
  });

  it('a hover the page styles in CSS lands as an element state on the layer', () => {
    const { behaviour: _none, ...plain } = button(undefined);
    const clips = clipsOfPlan(page([{ ...plain, hover: { fill: 'rgb(0, 51, 153)', durationMs: 150, easing: 'linear' } }]));

    expect(clips.flatMap((c) => c.states ?? []).map((r) => r.overrides)).toEqual([{ fill: '#003399' }]);
  });

  it('a button whose hover the page styles keeps that hover instead of guessed Hover and Pressed variants', () => {
    const { behaviour: _none, ...plain } = button(undefined);
    const hovering = (id: string, x: number): RestNode => ({ ...plain, id, absoluteBoundingBox: box(x, 20, 120, 40), hover: { fill: 'rgb(0, 51, 153)', durationMs: 150, easing: 'linear' }, children: [{ ...text(`${id}-l`, 'Buy now', 30), absoluteBoundingBox: box(x + 10, 30, 90, 20) }] });
    const doc = urlPlan(page([hovering('one', 20), hovering('two', 200)]), newId, undefined, {}, FULL_SHAPE)!.plan.items[0].doc;
    const mains = Object.values(doc.comps).filter((c) => c.component?.name.startsWith('Button'));

    expect(mains.length).toBeGreaterThan(0);
    expect(mains.map((c) => c.component?.variant?.State)).not.toContain('Hover');
    expect(mains.flatMap((c) => c.tracks.flatMap((t) => t.clips.flatMap((clip) => clip.states ?? []))).map((r) => r.overrides.fill)).toContain('#003399');
  });

  it('astro.build file tree: what a closed details folds is hidden down to its last layer, not just its list', () => {
    const row: RestNode = { id: 'row', type: 'FRAME', name: 'li', absoluteBoundingBox: box(20, 80, 200, 24), fills: [{ type: 'SOLID', color: ink }], children: [text('file', 'robots.txt', 82)] };
    const list: RestNode = { id: 'list', type: 'FRAME', name: 'ul', collapsed: true, absoluteBoundingBox: box(20, 80, 200, 48), fills: [], strokes: [{ type: 'SOLID', color: ink }], strokeWeight: 1, layoutMode: 'VERTICAL', children: [row] };
    const clips = clipsOfPlan(page([list]));
    const shown = clips.filter((c) => !c.hidden && (c.props.text === 'robots.txt' || c.name === 'li'));

    expect(shown.map((c) => c.name)).toEqual([]);
  });
});
