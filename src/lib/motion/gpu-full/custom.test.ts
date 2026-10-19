import { describe, expect, it } from 'vitest';
import { FEEGA_TOKENS } from '../brand';
import { MotionFormat, newMotionDoc, type MotionDoc } from '../doc';
import { addClip, type OpResult } from '../timeline';
import { drawFrame, ItemKind, prepare, Unsupported } from './display-list';
import { DomGap, DrawnKind, type DomRead } from './dom/read';
import { FillRule, PaintKind } from './paint';

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
});
