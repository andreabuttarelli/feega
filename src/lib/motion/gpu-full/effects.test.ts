import { describe, expect, it } from 'vitest';
import { FEEGA_TOKENS } from '../brand';
import { MotionFormat, newMotionDoc, type MotionClip, type MotionDoc } from '../doc';
import { addClip, type OpResult } from '../timeline';
import { displayListAt, FilterKind, ItemKind, type PathItem } from './display-list';

function must(r: OpResult): MotionDoc {
  if (!r.ok) {
    throw new Error(r.error);
  }
  return r.doc;
}

const withCard = must(addClip(newMotionDoc(MotionFormat.Landscape), { component: 'Shape', from: 0, durationInFrames: 90, props: { shape: 'rect', fill: '#ff0000', x: 0.5, y: 0.5, width: 0.2, height: 0.2 } }, 'card'));
const withEffects = (effects: unknown[]) => ({ ...withCard, tracks: withCard.tracks.map((t) => ({ ...t, clips: t.clips.map((c) => (c.id === 'card' ? ({ ...c, effects } as MotionClip) : c)) })) });
const drawn = (doc: MotionDoc) => displayListAt(doc, 0, FEEGA_TOKENS);
const card = (doc: MotionDoc) => drawn(doc).items.find((i): i is PathItem => i.kind === ItemKind.Path && i.clip === 'card');
const effect = (kind: string, params: Record<string, number | string> = {}) => ({ id: kind, kind, enabled: true, params });

describe('effects as filters', () => {
  it('hands a CSS-filter effect over as its functions, in order', () => {
    const item = card(withEffects([effect('brightness-contrast', { brightness: 1.5 }), effect('gaussian-blur', { radius: 4 })]));

    expect(item?.filters?.map((f) => f.kind)).toEqual([FilterKind.Css, FilterKind.Css]);
    expect(item?.filters?.[0]).toMatchObject({ kind: FilterKind.Css, fns: [{ name: 'brightness', args: ['1.5'] }, { name: 'contrast', args: ['1'] }] });
    expect(item?.blur).toBe(0);
  });

  it('hands an SVG-filter effect over as its primitives', () => {
    const item = card(withEffects([effect('inner-shadow')]));

    expect(item?.filters?.[0]).toMatchObject({ kind: FilterKind.Svg });
  });

  it('reads a background blur as a backdrop, not a filter', () => {
    expect(card(withEffects([effect('background-blur', { radius: 10 })]))?.backdrop).toBe(10);
  });

  it('runs the grain and wave effects, whose noise is computed on the GPU', () => {
    expect(card(withEffects([effect('noise'), effect('wave')]))?.filters).toHaveLength(2);
  });
});
