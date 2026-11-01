import { describe, expect, it } from 'vitest';
import { everyClip } from '@feega/motion-core/motion/doc';
import { ElementState } from '@feega/motion-core/motion/states/model';
import type { RestNode } from '$lib/server/figma/rest-message';
import type { PageTree } from './page-tree';
import { PLAIN_SHAPE, urlPlan } from './url-doc';

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
    const hover = { state: ElementState.Hover, overrides: { fill: '#003399' }, transition: { easing: 'standard', durationMs: 150 } } as const;
    const clips = clipsOfPlan(page([button({ states: [hover] })]));

    expect(clips.filter((c) => c.states?.length).map((c) => c.states)).toEqual([[hover]]);
  });

  it('a node without behaviour gives a clip without states or interactions', () => {
    const clips = clipsOfPlan(page([button(undefined)]));

    expect(clips.some((c) => c.states || c.interactions)).toBe(false);
  });
});
