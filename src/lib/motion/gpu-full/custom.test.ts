import { describe, expect, it } from 'vitest';
import { FEEGA_TOKENS } from '../brand';
import { MotionFormat, newMotionDoc, type MotionDoc } from '../doc';
import { addClip, type OpResult } from '../timeline';
import { drawFrame, ItemKind, prepare, Unsupported } from './display-list';
import { DomGap, DrawnKind, type DomRead } from './dom/read';
import { FillRule, PaintKind } from './paint';
import { BlendMode } from '../blend';
import { MaskMode } from '../mask';
import { CoverKind } from './mask-layers';
import { FilterKind } from './filters';
import type { Affine } from '../affine';

function must(r: OpResult): MotionDoc {
  if (!r.ok) {
    throw new Error(r.error);
  }
  return r.doc;
}

const poster = { source: { html: '', css: '', js: '' }, propsSchema: { type: 'object' as const, properties: {} }, version: 1, check: null };
const doc = must(addClip({ ...newMotionDoc(MotionFormat.Landscape), components: { Poster: poster } }, { component: 'Custom', from: 0, durationInFrames: 30, props: { name: 'Poster' } }, 'poster'));

const read: DomRead = {
  drawn: [
    { kind: DrawnKind.Path, contours: [[0, 0, 10, 0, 10, 10]], rule: FillRule.NonZero, paint: { kind: PaintKind.Solid, color: [1, 0, 0, 1] }, opacity: 0.5, matrix: [1, 0, 0, 1, 5, 5] },
    { kind: DrawnKind.Layer, layer: 2, width: 320, height: 180, opacity: 1, matrix: [1, 0, 0, 1, 0, 0] }
  ],
  gaps: [{ element: 'div.title', reason: DomGap.Text, count: 3 }]
};

describe('drawFrame on a custom component', () => {
  it('names the component as unread until its DOM has been read', () => {
    expect(drawFrame(prepare(doc, FEEGA_TOKENS), 0).unsupported).toEqual([{ clip: 'poster', component: 'Custom', reason: Unsupported.Unread }]);
  });

  it('draws what was read, with canvases as layers keyed by clip, and names the rest', () => {
    const list = drawFrame(prepare(doc, FEEGA_TOKENS), 0, new Map([['poster', read]]));

    expect(list.items.map((i) => i.kind)).toEqual([ItemKind.Path, ItemKind.Layer]);
    expect(list.items[0]).toMatchObject({ clip: 'poster', opacity: 0.5, matrix: [1, 0, 0, 1, 5, 5] });
    expect(list.items[1]).toMatchObject({ clip: 'poster', source: 'poster:2', size: { width: 320, height: 180 } });
    expect(list.unsupported).toEqual([{ clip: 'poster', component: 'Custom', reason: Unsupported.Dom, detail: 'text div.title ×3' }]);
  });

  it('runs a clip effect once over the whole component, not on every shape', () => {
    const grained = structuredClone(doc);
    grained.tracks.flatMap((t) => t.clips)[0].effects = [{ id: 'grain', kind: 'noise', enabled: true, params: { size: 1.2, amount: 0.03, evolve: 0 } }] as never;
    const two: DomRead = { drawn: [read.drawn[0], { ...read.drawn[0], matrix: [1, 0, 0, 1, 20, 20] }], gaps: [] };

    const { items } = drawFrame(prepare(grained, FEEGA_TOKENS), 0, new Map([['poster', two]]));
    const [group] = items;

    expect(items).toHaveLength(1);
    expect(group.kind).toBe(ItemKind.Group);
    expect(group.filters).toHaveLength(1);
    expect(group.kind === ItemKind.Group && group.items.map((i) => [i.filters, i.opacity])).toEqual([
      [undefined, 0.5],
      [undefined, 0.5]
    ]);
  });

  it('keeps the clip, filter and blend the component gave a shape, placed with the clip', () => {
    const mask = { mode: MaskMode.Intersect, invert: false, level: 1, feather: 0, cover: { kind: CoverKind.Path as const, contours: [[0, 0, 4, 0, 4, 4]], matrix: [1, 0, 0, 1, 0, 0] as Affine } };
    const filter = { kind: FilterKind.Css as const, fns: [{ name: 'blur', args: ['2px'] }] };
    const shaped: DomRead = { drawn: [{ ...read.drawn[0], masks: [mask], filters: [filter], space: [1, 0, 0, 1], blend: BlendMode.Multiply }], gaps: [] };
    const moved = structuredClone(doc);
    moved.tracks.flatMap((t) => t.clips)[0].transform.x = 0.1;

    const [item] = drawFrame(prepare(moved, FEEGA_TOKENS), 0, new Map([['poster', shaped]])).items;

    expect(item.blend).toBe(BlendMode.Multiply);
    expect(item.filters).toEqual([filter]);
    expect(item.masks?.[0].cover.matrix).toEqual([1, 0, 0, 1, item.matrix[4] - 5, item.matrix[5] - 5]);
    expect(item.matrix[4]).not.toBe(5);
  });
});
