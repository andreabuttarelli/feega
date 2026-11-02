import { describe, expect, it } from 'vitest';
import { MotionFormat, newMotionDoc, type MotionDoc } from '../doc';
import { addClip, type OpResult } from '../timeline';
import { EffectKind } from './registry';
import { paintBleed } from './paint-area';

function must(r: OpResult): MotionDoc {
  if (!r.ok) {
    throw new Error(r.error);
  }
  return r.doc;
}

const element = (props: Record<string, unknown>, effects: unknown[] = []) => {
  const doc = must(addClip({ ...newMotionDoc(MotionFormat.Landscape), width: 200, height: 100 } as MotionDoc, { component: 'Shape', from: 0, props: { shape: 'rect', x: 0.5, y: 0.5, width: 1, height: 1, ...props } }, 'r'));
  return { ...doc, tracks: doc.tracks.map((t) => ({ ...t, clips: t.clips.map((c) => ({ ...c, effects })) })) } as MotionDoc;
};

describe('how far an element paints past its own box', () => {
  it('a plain shape paints nothing outside its box', () => {
    expect(paintBleed(element({}))).toBe(0);
  });

  it('a drop shadow 40 px down reaches at least 40 px out', () => {
    const shadowed = element({}, [{ id: 's', kind: EffectKind.DropShadow, enabled: true, params: { distance: 0, x: 0, y: 40, blur: 0 } }]);

    expect(paintBleed(shadowed)).toBeGreaterThanOrEqual(40);
  });

  it('a hidden effect paints nothing', () => {
    const hidden = element({}, [{ id: 's', kind: EffectKind.DropShadow, enabled: false, params: { y: 40 } }]);

    expect(paintBleed(hidden)).toBe(0);
  });

  it('a stroke reaches out by its width', () => {
    const stroked = element({ strokes: [{ paint: { type: 'solid', color: '#000000' }, width: 0.1 }] });

    expect(paintBleed(stroked)).toBeGreaterThanOrEqual(10);
  });
});
