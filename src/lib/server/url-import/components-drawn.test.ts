import { describe, expect, it } from 'vitest';
import { planOf } from '$lib/canvas/figma/figma-doc';
import { restMessage, type RestNode } from '$lib/server/figma/rest-message';
import { withAutoLayout } from '@feega/motion-core/motion/layout/resolve';
import { withStacking } from '@feega/motion-core/motion/layout/stacking';
import { flattenComps } from '@feega/motion-core/motion/precomp';
import { withoutHidden } from '@feega/motion-core/motion/organize';
import { apply2d, pivotBox, worldAt } from '@feega/motion-core/motion/parent';
import type { MotionClip, MotionDoc } from '@feega/motion-core/motion/doc';
import { repeatedOf } from './repeated';
import { urlPlan } from './url-doc';

const BLACK = { r: 0, g: 0, b: 0, a: 1 };
const WHITE = { r: 1, g: 1, b: 1, a: 1 };
const GREY = { r: 0.9, g: 0.9, b: 0.9, a: 1 };

let ids = 0;
const id = () => `n${++ids}`;
const box = (x: number, y: number, width: number, height: number) => ({ x, y, width, height });

const text = (characters: string, x: number, y: number, width = 60): RestNode => ({ id: id(), type: 'TEXT', name: characters, characters, absoluteBoundingBox: box(x, y, width, 16), fills: [{ type: 'SOLID', color: BLACK }], style: { fontFamily: 'Inter', fontSize: 13, fontWeight: 500 } });

const vector = (x: number, y: number, side: number): RestNode => ({ id: id(), type: 'VECTOR', name: 'path', absoluteBoundingBox: box(x, y, side, side), fills: [{ type: 'SOLID', color: BLACK }] });

const icon = (x: number, y: number, dot = 6): RestNode => ({ id: id(), type: 'GROUP', name: 'icon', absoluteBoundingBox: box(x, y, 14, 14), children: [vector(x, y, 14), vector(x + 4, y + 4, dot)] });

const row = (label: string, x: number, y: number, width = 208, dot = 6): RestNode => ({
  id: id(),
  type: 'FRAME',
  name: 'a',
  layoutMode: 'HORIZONTAL',
  itemSpacing: 8,
  paddingLeft: 7,
  counterAxisAlignItems: 'CENTER',
  absoluteBoundingBox: box(x, y, width, 28),
  fills: [{ type: 'SOLID', color: GREY }],
  children: [icon(x + 7, y + 7, dot), text(label, x + 29, y + 6)]
});

const card = (title: string, x: number, width: number, image: string): RestNode => ({
  id: id(),
  type: 'FRAME',
  name: 'article',
  absoluteBoundingBox: box(x, 300, width, 240),
  fills: [{ type: 'SOLID', color: GREY }],
  cornerRadius: 8,
  children: [{ id: id(), type: 'RECTANGLE', name: 'image', absoluteBoundingBox: box(x, 300, width, 120), fills: [{ type: 'IMAGE', imageRef: image }] }, text(title, x + 10, 430), text('Read more', x + 10, 460)]
});

const page = (children: RestNode[], extra: Partial<RestNode> = {}): RestNode => ({ id: id(), type: 'FRAME', name: 'Page', absoluteBoundingBox: box(0, 0, 1280, 800), fills: [{ type: 'SOLID', color: WHITE }], children, ...extra });

const sidebar = (rows: RestNode[]): RestNode => ({ id: id(), type: 'FRAME', name: 'nav', layoutMode: 'VERTICAL', itemSpacing: 2, absoluteBoundingBox: box(40, 100, 208, rows.length * 30 - 2), children: rows });

function drawn(root: RestNode): string[] {
  let n = 0;
  const doc = planOf(restMessage([root], 'test'), () => `c${++n}`)!.items[0].doc as MotionDoc;
  const flat = flattenComps(withStacking(withAutoLayout(withoutHidden(doc))));
  const size = { width: flat.width, height: flat.height };
  const leaves = flat.tracks.flatMap((t) => t.clips as MotionClip[]).filter((c) => c.component !== 'Precomp');
  return leaves
    .map((c) => {
      const b = pivotBox(c.props, size);
      const [x, y] = apply2d(worldAt(flat, c.id, 0, size), [b.left, b.top]);
      return `${c.component} ${String(c.props.text ?? '')} ${Math.round(x)},${Math.round(y)} ${Math.round(b.width)}x${Math.round(b.height)}`;
    })
    .sort();
}

const linked = (root: RestNode) => urlPlan({ url: 'https://example.com', title: 'Example', root } as never, () => `id${++ids}`)!.components;

describe('a block in an auto layout row', () => {
  it('takes the room of its box, not only of what it draws', () => {
    const block: RestNode = { id: id(), type: 'GROUP', name: 'div', absoluteBoundingBox: box(0, 0, 640, 100), children: [text('Agentic', 24, 40)] };
    const tree = page([{ id: id(), type: 'FRAME', name: 'row', layoutMode: 'HORIZONTAL', absoluteBoundingBox: box(0, 0, 1280, 100), children: [block] }]);
    const scale = 2;

    expect(drawn(tree).find((l) => l.startsWith('Text Agentic'))).toContain(` ${24 * scale},${40 * scale} `);
  });
});

describe('a page made of components is drawn where the plain page is', () => {
  it('a row with a two-path icon draws the icon in the main and in the instance', () => {
    const tree = page([row('Inbox', 40, 100), row('Reviews', 40, 140)]);

    expect(drawn(repeatedOf(tree).root)).toEqual(drawn(tree));
    expect(linked(tree)).toEqual({ components: 1, instances: 1 });
  });

  it('rows stacked in an auto layout sidebar keep their icons and labels in place', () => {
    const tree = page([sidebar([row('Inbox', 40, 100), row('Reviews', 40, 130), row('Projects', 40, 160)])]);

    expect(drawn(repeatedOf(tree).root)).toEqual(drawn(tree));
    expect(linked(tree)).toEqual({ components: 1, instances: 2 });
  });

  it('rows whose icons differ inside the icon group link, each with its own icon', () => {
    const tree = page([sidebar([row('Inbox', 40, 100, 208, 6), row('Reviews', 40, 130, 208, 8), row('Projects', 40, 160, 208, 4)])]);

    expect(drawn(repeatedOf(tree).root)).toEqual(drawn(tree));
    expect(linked(tree)).toEqual({ components: 1, instances: 2 });
  });

  it('copies that differ only in size link as instances with a size override', () => {
    const tree = page([card('One', 0, 200, 'https://a/1.png'), card('Two', 220, 260, 'https://a/1.png'), card('Three', 500, 200, 'https://a/1.png')]);

    expect(drawn(repeatedOf(tree).root)).toEqual(drawn(tree));
    expect(linked(tree)).toEqual({ components: 1, instances: 2 });
  });

  it('cards with different pictures link, and each instance keeps its own picture', () => {
    const tree = page([card('One', 0, 200, 'https://a/1.png'), card('Two', 220, 200, 'https://a/2.png')]);
    const made = urlPlan({ url: 'https://example.com', title: 'Example', root: tree } as never, () => `id${++ids}`)!;

    expect(made.components).toEqual({ components: 1, instances: 1 });
    expect(made.plan.items[0].images.filter((i) => i.innerId).map((i) => made.images[i.hash])).toEqual(['https://a/2.png']);
  });
});
